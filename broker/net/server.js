/*
 * Copyright (c) 2013, Samuel Colbran <contact@samuco.net>
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

var root = module.exports;
var http = require("http");
var soap = require("./soap");
var ilab = require("./ilab");
var config = require('../config')

var express = require('express');
var path = require('path');
var app = express();

var plugin_list = {};
var lab_list 	= {};

function start()
{
	//Start message
	//-------------------------------
	console.log("");
	console.log("iLab Service");
	console.log("Version: 1.0");
	console.log("  Build: 4");
	console.log("   Date: 12/12/2013");
	console.log("");

	//Initilisation functions
	//-------------------------------
	app.configure(function(){
		app.set('port', 8080);
		app.use(express.logger('dev'));
		app.use(express.methodOverride());
		app.use(express.bodyParser());
		app.use(app.router);

		app.set("jsonp callback", true); //Allow JSONP requests
	});
	
	app.configure('development', function(){
		app.use(express.errorHandler());
	});

	//Initialise auth plugins
	//-------------------------------
	console.log("Loading authentication...");
	var k = 0;
	for (k=0; k < config.auth_plugins.length; k++)
	{
		var dict = config.auth_plugins[k];
		var plug = require("./auth/" + dict.file);
		
		plug.createAuth(app, root);
		plugin_list[dict.name] = plug;
	
		console.log("Loaded " + dict.name);
	}
	console.log("");


	//Check out IMS Global for Auth stuff
	//Communication with clients using JSON
	//-------------------------------

	//Replies
	function sendReplyToClient(client, data_dictionary)
	{
		if (client.type == "json")
		{
			var json_string = JSON.stringify(data_dictionary);

			client.response.writeHead(200, {'Content-Type': 'application/json'});
	    	client.response.write(json_string);
	    	client.response.end();
		}
		else if (client.type == "jsonp")
		{
			client.response.jsonp(data_dictionary);
		}
		else
		{
			console.log("Unknown client protocol");
		}
	}

	function receiveDataFromClient(client)
	{
		var json = client.json;
		console.log("Received action: " + json.action);

		if (json.action == "getBrokerInfo")
		{
			sendReplyToClient(client, {vendor:config.vendor});
		}
		else if (json.action == "getLabList")
		{
			var labList = [];
			for (var n=0; n < config.servers.length; n++)
			{
				labList.push(config.servers[n].id);
			}
			sendReplyToClient(client, labList);
		}
		else if (json.action == "getLabConfiguration")
		{
			var selected_server = lab_list[json['id']];
			if (selected_server)
			{
				selected_server.getLabConfiguration(function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
			else
			{
				console.log("Missing server");
			}
		}
		else if (json.action == "getLabStatus")
		{
			var selected_server = lab_list[json['id']];
			if (selected_server)
			{
				selected_server.getLabStatus(function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
		}
		else if (json.action == "getEffectiveQueueLength")
		{
			var selected_server = lab_list[json['id']];
			if (selected_server)
			{
				selected_server.getEffectiveQueueLength('default', 0, function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
		}
	}

	//Show an information page
	app.get('/', function(req, res)
	{
		res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.write("iLab Broker Service - 1.0");
	    res.end();
	});

	//Server creation
	//-------------------------------
	http.createServer(app).listen(app.get('port'), function(){
		if (config.verbose) console.log("Express server listening on port " + app.get('port'));
	});

	//Connection to Lab Servers
	//-------------------------------

	//Connect in order (to avoid overlap issues)
	var current_server_number = 0;
	function nextServer()
	{
		if (current_server_number < config.servers.length)
		{
			var server_data = config.servers[current_server_number];
			var lab_server = new ilab.iLabServer(server_data, function() {
				lab_server.getLabStatus(function(xml, err){
					if (err)
						console.log(err);
					else
						console.log("Status " + xml);

					current_server_number++;
					nextServer();
				});
			});
			lab_list[server_data.id] = lab_server;
		}
	}

	nextServer();
		
/*
	var i;
	for (i=0; i < config.servers.length; i++)
	{
		var server_data = config.servers[i];
		var ilab = require("./ilab");

		var lab_server = ilab.connectTo(server_data, function() {
			lab_server.getLabStatus(function(xml, err){
				if (err)
					console.log(err);
				else
					console.log("Status " + xml);
			});
		});
		lab_list[server_data.id] = lab_server;
	}
*/
	root.receiveDataFromClient = receiveDataFromClient;
}
exports.start = start;