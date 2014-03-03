/*
 * Copyright (c) 2014, Samuel Colbran <contact@samuco.net>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 
 * Redistributions in binary form must reproduce the above copyright notice, this
 * list of conditions and the following disclaimer in the documentation and/or
 * other materials provided with the distribution.
 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var crypto 	 = require('crypto');
var express  = require('express');
var database = require('./database');

var brokers  = {};
var broker_module = module.exports;

//JavaScript broker objects
//----------------------------------------
//Creates a new broker object
broker_module.createBroker = function (guid, key, host, port)
{
	var new_broker = new function(guid, key, host, port)
	{
		this._guid = guid;
		this._key  = key;
		this._host = host;
		this._port = port;

		//Returns the http address for the broker
		this.http_address = function(http_protocol) 
		{
			http_protocol = typeof http_protocol !== 'undefined' ? http_protocol : 'http';
			return "{0}://{1}:{2}/".format(http_protocol,this._host,this._port);
		}
		this.authenticate = function(key)
		{
			return (key == this._key);
		}
		this.update(guid, key, host, port)
		{
		}
	}

	//Add to the broker dictionary
	brokers[guid] = new_broker;
	
	//Return the new broker
	return new_broker;
};

//Returns a broker from the broker array
broker_module.findBroker = function (guid)
{
	if (guid in brokers)
	{
		return brokers[guid];
	}
	return undefined;
}

broker_module.flushBrokers = function ()
{
	var saved_brokers = database.getBrokers(function(broker_array)
	{
		brokers={};
		for (var i = 0; i < broker_array.length; i++)
		{
			var broker_data = broker_array[i];
			var guid = broker_data['guid'];
			var key  = broker_data['key'];
			var host = broker_data['host'];
			var port = broker_data['port'];
			broker_module.createBroker(guid,key,host,port);
		}
	});
}

//Data transfer between broker and lab servers
//----------------------------------------
broker_module.sendDataToClient = function(client, data_dictionary)
{
	if (client.type == "json")
	{
		var json_string = JSON.stringify(data_dictionary);
		client.response.writeHead(200, {'Content-Type': 'application/json'});
    	client.response.write(json_string);
    	return client.response.end();
	}
	else if (client.type == "jsonp")
		return client.response.jsonp(data_dictionary);
	return console.log("Unknown client protocol");
}

//Returns an error message to the broker
broker_module.sendErrorToClient = function(client, error)
{
	broker_module.sendDataToClient(client, {'error':error});
}

//Handle received data
broker_module.receivedDataFromClient = function (client)
{
	var json = client.json;

	var auth_scheme = json['auth'];
	if (auth_scheme == "mit") //MIT authentication scheme
	{
		var broker_guid = json['guid'];
		var broker_pass = json['pass'];

		var broker = broker_module.findBroker(broker_guid);
		if (broker.authenticate(broker_pass))
		{
		}
	}
}

//Express channels
//----------------------------------------
//Sets up the broker communication channels
broker_module.setupExpress = function (app)
{
	app.get('/jsonp', function(req, res)
	{
		var client = {request:req,response:res,json:req.query,type:'jsonp'};
		broker_module.receivedDataFromClient(client);
	});
	app.get('/jsonp', function(req, res)
	{
		var client = {request:req,response:res,json:req.body,type:'json'};
		broker_module.receivedDataFromClient(client);
	});
};