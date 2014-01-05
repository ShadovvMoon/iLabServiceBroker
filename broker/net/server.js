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
var crypto = require('crypto')

var adminui = require("./admin-ui");
var soap = require("./soap");
var ilab = require("./ilab");
var config = require('../config')

var express = require('express');
var path = require('path');

var app = express();

var plugin_list = {};
var lab_list 	= {};
var error_list 	= {};

//Get server information
var Store = require('ministore')('database')
var access_users = Store('users');
var server_settings = Store('settings');
var servers_database = Store('servers');

//Auth
passport = require("passport");
LocalStrategy = require('passport-local').Strategy;

//Passport
passport.serializeUser(function(user, done)
{
  	done(null, user);
});

passport.deserializeUser(function(obj, done)
{
  	done(null, obj);
});

passport.use(new LocalStrategy
(
  	function(username, password, done)
  	{
       	console.log("LocalStrategy working...");
		var selected_user = access_users.get(username);
		if (selected_user)
		{
			var shasum = crypto.createHash('sha1'); shasum.update(config.salt); shasum.update(password);
			var d = shasum.digest('hex');

			console.log(selected_user['id'] + ' ' + username + ' ' + password + ' ' + selected_user['hash'] + ' ' + d);
			if (selected_user['hash'] == d)
			{
				return done(null, {id:selected_user['id'] , username:username, password:password});
			}
			else
			{
				return done(null, false, { message: 'Incorrect password.' });
			}
		}
		else
		{
			return done(null, false, { message: 'Incorrect username.' });
		}
  	}
));

function flushServers()
{
	//Connect in order (to help with debugging)
	var current_server_number = 0;
	function nextServer()
	{
		if (current_server_number < servers_database.length())
		{
			//Need to variable scope this so I can connect to more than one at a time.
			var server_data = servers_database.get(servers_database.list()[current_server_number]);
			var port_number = 80;
			var host_name	= server_data['host'];

			var n = server_data['host'].split(":");
			if (n.length == 2)
			{
				host_name 	= n[0];
				port_number = n[1];
			}
			
			//Convert the server_data into a nicer format
			var params = {host: host_name,
						  port: port_number,
							id: server_data['id'],

					   service: server_data['service'],
					   passkey: server_data['key'],
						  guid: server_settings.get('vendor-guid')};
	
			var lab_server = new ilab.iLabServer(params, function() {
				lab_server.getLabStatus(function(xml, err){
					if (err)
					{
						error_list[server_data.id] = err;
						console.log(err);
					}
					else
					{
						lab_list[server_data.id] = lab_server;
						console.log("Status " + xml);
					}

					current_server_number++;
					nextServer();
				});
			});
			
		}
	}

	nextServer();
}

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
	var secret = 'Some secret thingo';//'''+crypto.randomBytes(64)+'';
	app.configure(function(){
		app.set('port', 8080);
		app.use(express.logger('dev'));

		app.use(express.cookieParser());
		app.use(express.bodyParser());
		app.use(express.session({ secret: secret }));
		app.use(passport.initialize());
		app.use(passport.session());
		app.use(express.methodOverride());
		app.use(app.router);

		//Interface junk
		app.set('views', __dirname + '/ui/views');
		app.set('view engine', 'jade');
		app.use(express.favicon());
		app.use(express.logger('dev'));

		app.use(express.static(path.join(__dirname, 'ui/public')));
		app.set("jsonp callback", true); //Allow JSONP requests
	});
	
	app.configure('development', function(){
		app.use(express.errorHandler());
	});

	//Load the admin UI
	//-------------------------------
	var shasum = crypto.createHash('sha1'); shasum.update(config.salt); shasum.update('password');
	var d = shasum.digest('hex');
		
	if (!access_users.get('admin'))
	{
		console.log("Creating admin user");
		console.log("------------------");
		console.log("Username: admin");
		console.log("Password: password");
		console.log("------------------");

		access_users.set('admin', 
			   {role: 'admin',
				  id:1,
				hash: d});
	}

	//Create the generic settings
	//-------------------------------
	if (!server_settings.get('vendor-name'))
	{
		server_settings.set('vendor-name', 'Default name');
	}

	if (!server_settings.get('vendor-guid'))
	{
		var random_uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});
		server_settings.set('vendor-guid', random_uuid);
	}

	adminui.create(app, root, passport, {'users': access_users, 'settings': server_settings, 'servers': servers_database});


	
	/*
	app.post('/', function(req, res)
	{
		var username = req.body['username'];
		var password_hash = req.body['hash'];
		
		//Check this username is valid
		if (username && password_hash)
		{
			var selected_user = access_users.get(username);
			if (selected_user)
			{
				if (selected_user['hash'] == password_hash)
				{
					//Valid user
					res.cookie('u', username, { signed: true });
					res.cookie('h', password_hash, { signed: true });


					//res.redirect('http://www.apple.com');
				}
				else
				{
					//Invalid password
					console.log("Invalid password");
					res.render('login');
				}
			}
			else
			{
				//User does not exist
				console.log("Invalid user");
				res.render('login');
			}
		}
		else
		{
			console.log(req.body);
		}
		
	});
	*/
	
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

	function receiveAdminDataFromClient(client)
	{
		var json = client.json;
		console.log("Received action: " + json.action);
	
		if (json.action == "getLabInfo")
		{
			sendReplyToClient(client, servers_database.get(json['id']));
		}
		else if (json.action == "getBrokerInfo")
		{
			sendReplyToClient(client, {vendor: server_settings.get('vendor-name'), guid: server_settings.get('vendor-guid')});
		}
		else if (json.action == "deleteLab")
		{
			servers_database.remove(json['id']);
		}
	}

	function receiveDataFromClient(client)
	{
		var json = client.json;
		console.log("Received action: " + json.action);

		if (json.action == "getBrokerInfo")
		{
			sendReplyToClient(client, {vendor: server_settings.get('vendor-name')});
		}
		else if (json.action == "getLabList")
		{
			var labList = [];

			var keys = servers_database.list();
			for (var n=0; n < keys.length; n++)
			{
				labList.push(servers_database.get(keys[n]).id);
			}

			sendReplyToClient(client, labList);
		}

		var error_message = error_list[json['id']];
		if (error_message)
		{
			sendReplyToClient(client, {error: error_message});
			return;
		}

		var selected_server = lab_list[json['id']];
		if (selected_server)
		{
			if (json.action == "getLabConfiguration")
			{
				var responseFunction = (function(lab_id, response_client)
				{
                   return function(obj, err)
				   {
					   console.log("Responding " + lab_id);
	                   sendReplyToClient(response_client, obj);
                   };
                })(json['id'], client);
                selected_server.getLabConfiguration(responseFunction);
			}
			else if (json.action == "getLabStatus")
			{
				selected_server.getLabStatus(function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
			else if (json.action == "getEffectiveQueueLength")
			{
				selected_server.getEffectiveQueueLength('default', 0, function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
			else if (json.action == "cancel")
			{
				selected_server.cancel(json['experimentID'], function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
			else if (json.action == "getExperimentStatus")
			{
				selected_server.getExperimentStatus(json['experimentID'], function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
			else if (json.action == "retrieveResult")
			{
				selected_server.retrieveResult(json['experimentID'], function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
			else if (json.action == "submit")
			{
				selected_server.submit(json['experimentID'], json['experimentSpecification'], 'default', 0, function(obj, err)
				{
					sendReplyToClient(client, obj);
				});
			}
			else if (json.action == "validate")
			{
				selected_server.validate(json['experimentSpecification'], 'default', function(obj, err)
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
	flushServers();

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
	root.receiveAdminDataFromClient = receiveAdminDataFromClient;
	root.receiveDataFromClient = receiveDataFromClient;
	root.flushServers = flushServers;
}
exports.start = start;