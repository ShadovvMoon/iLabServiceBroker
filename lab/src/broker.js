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

var crypto 	   = require('crypto');
var express    = require('express');
var database   = require('./database');
var queue      = require('./queue');
var experiment = require('./experiment');

var brokers  = {};
var broker_module = module.exports;

//JavaScript broker objects
//----------------------------------------
//Creates a new broker object
broker_module.createBroker = function (guid, key, host, port)
{
	function hmacsha1(key, text)
	{
   		return crypto.createHmac('sha1', key).update(text).digest('base64')
	}

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
		this.mit_authenticate = function(key)
		{
			return (key == this._key);
		}
		this.new_authentication = function(req)
		{
			if (req)
			{
				var current_time = new Date().getTime(); //in ms
	
				var uid        = req['guid'];
				var token      = req['token'];
				var time_stamp = req['time-stamp'];
	
				req['token'] = '';
	
				if (uid && token)
				{
					if (this._key)
					{
						var dictionaryAttribute = JSON.stringify(req);
						var computedSignature = hmacsha1(this._key, uid+dictionaryAttribute);
						if (computedSignature == token)
						{
							if (current_time-time_stamp < 10000 && current_time-time_stamp >= 0) //Needs to be less than ten seconds.
							{
								return true;
							}//else console.log("Authentication failed - timeout (" + (current_time-time_stamp)/1000 + ")");
						}// else console.log("Authentication failed - invalid signature " + computedSignature + " " + token);
					}// else console.log("Authentication failed - missing server key");
				}// else console.log("Authentication failed - guid or token missing");
			}// else console.log("Authentication failed - missing request");
			return false;
		}
		this.update = function(guid, key, host, port)
		{
		}

		return this;
	}(guid, key, host, port);

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
	console.log(error);
	broker_module.sendDataToClient(client, {'error':error});
}

//Handles authenticated data from clients
broker_module.receivedDataFromClient = function (client)
{
	var json = client.json;
	var params = json.params;
	var action = json.action;

	if (action == 'getEffectiveQueueLength')
	{
		//Two params for this action. We will ignore them for now.
		var userGroup = params['userGroup'];
		var priorityHint = params['priorityHint'];
	
		//Get the queue length from the queue module
		var queue_length = queue_module.queueLength();
		var queue_wait   = queue_module.estimatedWait();

		//Send the appropriate reply to the client.
		broker_module.sendDataToClient(client, {effectiveQueueLength: String(queue_length), estWait: String(queue_wait)});
	}
	else if (action == 'getLabConfiguration')
	{
		var configuration = experiment.getLabConfiguration();
		broker_module.sendDataToClient(client, {labConfiguration: configuration});
	}
	else if (action == 'getLabStatus')
	{
		var lab_status = experiment.getStatus();
		broker_module.sendDataToClient(client, {online:true, labStatusMessage: lab_status});
	}
	else if (action == 'submit')
	{
		var experimentID            = params['experimentID'];
		var experimentSpecification = params['experimentSpecification'];
		var userGroup               = params['userGroup'];
		var priorityHint            = params['priorityHint'];

		experiment.submitExperiment(experimentSpecification, function (client) { return function(clientReturn){
			console.log("Replying to client " + JSON.stringify(clientReturn));
			broker_module.sendDataToClient(client, clientReturn);
			queue.pollQueue();
		}}(client));
	}
	else 
	{	
		console.log("Unsupported action from client " + action);
		console.log("Data from a broker " + JSON.stringify(json));
	}

 /*
   > cancel
   > getExperimentStatus
   > retrieveResult
   > submit
   > validate
*/

}

//Authenticate the received data
broker_module.authenticateDataFromClient = function (client)
{
	var json = client.json;

	var auth_scheme = json['auth'];
	if (auth_scheme == "token") //New authentication scheme
	{
		var broker_guid = json['guid'];
		var broker = broker_module.findBroker(broker_guid);

		if (typeof broker !== 'undefined')
		{
			if (broker.new_authentication(json))
			{
				broker_module.receivedDataFromClient(client);
			}
			else broker_module.sendErrorToClient(client, "Invalid token");
		}
		else broker_module.sendErrorToClient(client, "Invalid broker guid: " + broker_guid);
	}
	else if (auth_scheme == "mit") //MIT authentication scheme
	{
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
		broker_module.authenticateDataFromClient(client);
	});
	app.get('/json', function(req, res)
	{
		var client = {request:req,response:res,json:req.body,type:'json'};
		broker_module.authenticateDataFromClient(client);
	});

	broker_module.flushBrokers();
};