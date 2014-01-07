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

var root 		= module.exports;
var http 		= require("http");
var crypto 		= require('crypto')
var adminui 	= require("./admin-ui");
var soap 		= require("./soap");
var ilab 		= require("./ilab");
var config 		= require('../config')
var express 	= require('express');
var path 		= require('path');
var fs 			= require('fs');

var app = express();

var plugin_list = {};
var lab_list 	= {};
var error_list 	= {};

//Logging and debug information
var log_file 	= 'database/debug.log';
fs.unlink(log_file); //Delete the old log

var logStream = fs.createWriteStream(log_file, {flags: 'a'});
function hook_stdout(stream)
{
    var old_write = process.stdout.write
    process.stdout.write = (function(write)
	{
        return function(string, encoding, fd)
		{
			stream.write(string);
            write.apply(process.stdout, arguments);
        }
    })(process.stdout.write)
}
hook_stdout(logStream);

//Get server information
var Store 			 = require('ministore')('database')
var access_users 	 = Store('users');
var server_settings	 = Store('settings');
var servers_database = Store('servers');

//Auth
passport 		= require("passport");
LocalStrategy 	= require('passport-local').Strategy;

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
		var selected_user = access_users.get(username);
		if (selected_user)
		{
			var shasum = crypto.createHash('sha1'); shasum.update(config.salt); shasum.update(password);
			var d = shasum.digest('hex');

			if (selected_user['hash'] == d)
				return done(null, {id:selected_user['id'] , username:username, password:password});
			else
				return done(null, false, { message: 'Incorrect password.' });
		}
		else
			return done(null, false, { message: 'Incorrect username.' });
  	}
));

function loadServer(server_number, ordered, nextServer)
{
	//Need to variable scope this so I can connect to more than one at a time.
	var server_data = servers_database.get(servers_database.list()[server_number]);
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

	var lab_server = new ilab.iLabServer(params, function()
	{
		//Wrap the return function
		var responseFunction = (function(server)
		{
         	return function(xml, err)
	 		{
		  	 	if (err)
				{
					error_list[server.id] = err;
					console.log("ERROR: " + server.id + ", " + err);
				}
				else
				{
					lab_list[server.id] = lab_server;
					console.log("Status " + xml);
				}
	
				if (ordered)
				{
					server_number++; //Scope won't matter if servers are ordered.
					nextServer();
				}
           	};
      	})(server_data);
		lab_server.getLabStatus(responseFunction);
	});
}

function flushServers()
{
	if (config.flush_ordered) //Connect in order (helps with debugging)
	{
		var current_server_number = 0;
		var next_server = function nextServer()
		{
			if (current_server_number < servers_database.length())
			{
				loadServer(current_server_number, true, next_server);
			}
		}
		nextServer();
	}
	else
	{
		var i;
		for (i=0; i < servers_database.length(); i++)
		{
			loadServer(i, false);
		}
	}
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
		app.use(express.static(path.join(__dirname, 'ui/public')));

		app.use(express.logger());
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
				  id: 1,
				hash: d});
	}

	//Create the generic settings
	//-------------------------------
	if (!server_settings.get('vendor-name'))
		server_settings.set('vendor-name', 'Default name');

	if (!server_settings.get('vendor-guid'))
	{
		var random_uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
		function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});

		server_settings.set('vendor-guid', random_uuid);
	}

	adminui.create(app, root, passport, {'users': access_users, 'settings': server_settings, 'servers': servers_database});

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
			client.response.jsonp(data_dictionary);
		else
			console.log("Unknown client protocol");
	}

	//Administrator commands
	//-------------------------------
	function receiveAdminDataFromClient(client)
	{
		var json = client.json;
		switch(json.action)
		{
			case "getBrokerLog": 	//Returns the log string for the latest run of the broker
				var responseFunction = (function(response_client)
				{
	          		return function(err,data)
			 		{
					  	if (err)
							return console.log(err);
					
						sendReplyToClient(response_client, {log: data});;
	            	};
	       		})(client);
				fs.readFile(log_file, 'utf8', responseFunction);

				break;
			case "getBrokerInfo":	//Returns an extended version of the broker info (containing GUID)
				sendReplyToClient(client, {vendor: server_settings.get('vendor-name'),
										 	 guid: server_settings.get('vendor-guid')});

				break;
			case "getLabInfo": 		//Returns all the details about a lab server
				sendReplyToClient(client, servers_database.get(json['id']));
				break;
			case "deleteLab":  		//Deletes a lab server
				servers_database.remove(json['id']);
				break;
			default:
				console.log("Invalid admin action: " + json.action);
		}
	}

	//Client commands
	//-------------------------------
	function receiveDataFromClient(client)
	{
		var json = client.json;
		if (config.verbose) console.log("Received action: " + json.action);

		if (json.action == "getBrokerInfo")
			sendReplyToClient(client, {vendor: server_settings.get('vendor-name')});
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
			sendReplyToClient(client, {error: error_message});
		else
		{
			var selected_server = lab_list[json['id']];
			if (selected_server)
			{
				var responseFunction = (function(lab_id, response_client)
				{
	          		return function(obj, err)
			 		{
				  	 sendReplyToClient(response_client, obj);
	            	};
	       		})(json['id'], client);

				switch(json.action)
				{
					case "getLabConfiguration":
						selected_server.getLabConfiguration(responseFunction);
						break;
					case "getLabStatus":
						selected_server.getLabStatus(responseFunction);
						break;
					case "getEffectiveQueueLength":
						selected_server.getEffectiveQueueLength('default', 0, responseFunction);
						break;
					case "cancel":
						selected_server.cancel(json['experimentID'], response_client);
						break;
					case "getExperimentStatus":
						selected_server.getExperimentStatus(json['experimentID'], responseFunction);
						break;
					case "retrieveResult":
						selected_server.retrieveResult(json['experimentID'], responseFunction);
						break;
					case "submit":
						selected_server.submit(json['experimentID'], json['experimentSpecification'], 'default', 0, responseFunction);
						break;
					case "validate":
						selected_server.validate(json['experimentSpecification'], 'default', responseFunction);
						break;
				}
			}
		}
	}

	//Show an information page
	/*app.get('/', function(req, res)
	{
		res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.write("iLab Broker Service - 1.0");
	    res.end();
	});*/

	//Server creation
	//-------------------------------
	http.createServer(app).listen(app.get('port'), function(){
		if (config.verbose) console.log("Express server listening on port " + app.get('port'));
	});

	//Connection to Lab Servers
	//-------------------------------
	flushServers();

	//Function hooks
	//-------------------------------
	root.receiveAdminDataFromClient = receiveAdminDataFromClient;
	root.receiveDataFromClient = receiveDataFromClient;
	root.flushServers = flushServers;
}
exports.start = start;