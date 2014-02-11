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

var root 			 = module.exports;
var http 			 = require("http");
var crypto 			 = require('crypto')
var adminui 		 = require("./admin-ui");
var soap 			 = require("./soap");
var ilab 			 = require("./ilab");
var experiment_store = require("./data.js");
var config 			 = require('../config')
var express 		 = require('express');
var path 			 = require('path');
var fs 				 = require('fs');

var app = express();

var plugin_list = {};
var lab_list 	= {};
var error_list 	= {};

//Timing functions
var start_time = process.hrtime();
var reset_time = function()
{
	start_time = process.hrtime(); // reset the timer
}
var elapsed_time = function(note)
{
    var precision = 3; // 3 decimal places
    var elapsed = process.hrtime(start_time)[1] / 1000000; // divide by a million to get nano to milli
    console.log(process.hrtime(start_time)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    start_time = process.hrtime(); // reset the timer
}

//Get server information
var Store 			  = require('ministore')('database')
var access_users 	  = Store('users');
var server_settings	  = Store('settings');
var servers_database  = Store('servers');
var wrapper_database  = Store('wrappers');

//Auth
passport              = require("passport");
LocalStrategy         = require('passport-local').Strategy;
ConsumerStrategy      = require('../passport-http-2legged-oauth').Strategy; 

//Communication
XMLHttpRequest        = require("xmlhttprequest").XMLHttpRequest;

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
				return done(null, {id:selected_user['id'] , username:username, hash:d});
			else
				return done(null, false, { message: 'Incorrect password.' });
		}
		else
			return done(null, false, { message: 'Incorrect username.' });
  	}
));

//Use LTI wrapper instead
/*
var appList = {};
function findApp(key, next)
{
    var consumer = appList[key];
    if (consumer)
        next(null, {secret: consumer.secret});
   	else
        next(true);
}

passport.use(new ConsumerStrategy
(
  function(consumerKey, done)
  {
	findApp(consumerKey, function(err, consumer) {
        if (err) { return done(err); }
        if (!consumer) { return done(null, false); }
        console.log("Found an app with the suplied key '%s'", consumerKey);
        return done(null, consumer, consumer.secret);
    });
  },
  function checkTimestampAndNonce(timestamp, nonce, app, req, done)
  {
	console.log("Time checking");
    var timeDelta = Math.round((new Date()).getTime() / 1000) - timestamp;
    if (timeDelta >= 10) {
		console.log("failed");
        done(null, false);
    }
    else {
		console.log("successful");
        done(null, true);
    }
  }
));
*/

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
	if (config.show_performance) elapsed_time("Creating log file hook");

	//Logging and debug information
	var log_file 	= 'database/debug.log';
	fs.unlink(log_file, function(err) { //Delete the old log
	
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
	
	if (config.show_performance) elapsed_time("Starting broker");

	//Start message
	//-------------------------------
	console.log("");
	console.log("iLab Service");
	console.log("Version: 1.0");
	console.log("  Build: 5");
	console.log("   Date: 21/1/2014");
	console.log("");

	//Main broker port
	var default_port = 8080;
	var broker_port = server_settings.get('broker-port');
	if (!broker_port)
		broker_port = default_port;

	console.log(broker_port);

	if (config.show_performance) elapsed_time("Setting up express");

	//Initilisation functions
	//-------------------------------
	var secret = 'Some secret thingo';//'''+crypto.randomBytes(64)+'';
	app.configure(function(){
		app.set('port', broker_port);

		if (config.show_requests)
		{
			app.use(express.logger("dev"));
		}

		var cookieName = 'broker' + broker_port;
		app.use(express.cookieParser());
		app.use(express.bodyParser());
		app.use(require('session-middleware').middleware( secret, cookieName ));
		//app.use(express.session({ secret: secret }));
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

	if (config.show_performance) elapsed_time("Loading admin hashes");

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

	if (config.show_performance) elapsed_time("Checking generic settings");

	//Create the generic settings
	//-------------------------------
	if (!server_settings.get('vendor-name'))
		server_settings.set('vendor-name', 'Default name');

	if (!server_settings.get('broker-port'))
		server_settings.set('broker-port', default_port);

	if (!server_settings.get('vendor-guid'))
	{
		var random_uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
		function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});

		server_settings.set('vendor-guid', random_uuid);
	}

	adminui.create(app, root, passport, {'users': access_users, 'settings': server_settings, 'servers': servers_database, 'wrappers': wrapper_database});

	if (config.show_performance) elapsed_time("Loading plugins");

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

	if (config.show_performance) elapsed_time("Setting up reply functions");

	//Replies
	function sendReplyToClient(client, data_dictionary)
	{
		if (config.verbose) console.log(JSON.stringify(data_dictionary));
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
			case "updatePassword":
				var old_password = json['old'];
				var new_password = json['new'];
	
				//Check that the old password matches the user
				var shasum = crypto.createHash('sha1'); shasum.update(config.salt); shasum.update(old_password);
				var d = shasum.digest('hex');
				if (d == client.request.user.hash)
				{
					//Update the password file
					shasum = crypto.createHash('sha1'); shasum.update(config.salt); shasum.update(new_password);
					d = shasum.digest('hex');

					var user_settings = access_users.get(client.request.user.username);
					user_settings['hash'] = d;
					access_users.set(client.request.user.username, user_settings);

					client.request.user.hash = d;
					sendReplyToClient(client, {success:true});
				}
				else
					sendReplyToClient(client, {success:false});
				break;
			case "getWrappers":	//Returns all the wrapper information
				var labList = {};
				var keys = wrapper_database.list();
				for (var n=0; n < keys.length; n++)
				{
					labList[keys[n]] = (wrapper_database.get(keys[n]));
				}
				sendReplyToClient(client, labList);
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

	//Wrapper communication (consider moving this to the wrapper plugin?)
	//-------------------------------
	function wrapperForGUID(guid) //Should have used the GUID for the dictionary key...
	{
		var wraps = wrapper_database.list();
		var found_id = null;
		for (var i = 0; i < wraps.length; i++)
		{	
			if (wrapper_database.get(wraps[i])['guid'] == guid)
			{
				found_id = wraps[i];
				break;
			}
		}	
		return found_id;
	}
	function hmacsha1(key, text)
	{
	   	return crypto.createHmac('sha1', key).update(text).digest('base64')
	}
	function sendActionToWrapper(guid, data_dictionary, callback)
	{
		var found_id = wrapperForGUID(guid);
		if (found_id != null)
		{
			var wrapper_settings = wrapper_database.get(found_id);

			//Check whether the wrapper has registered
			var wrapper_host = wrapper_settings['host'];
			var wrapper_port = wrapper_settings['port'];
			var protocol = "reply-json";
			if (wrapper_host && wrapper_port)
			{
				require('crypto').randomBytes(48, function(ex, buf)
				{
					var secret      = buf.toString('hex');
					data_dictionary['time-stamp'] = new Date().getTime();
					data_dictionary['secret'] = secret;
					data_dictionary['token'] = '';
			
					var dictionaryAttribute = JSON.stringify(data_dictionary);
					var computedSignature = hmacsha1(wrapper_settings['key'], guid+dictionaryAttribute);
			
					data_dictionary['token'] = computedSignature;
			
					var xhr = new XMLHttpRequest();
					xhr.open('post',"http://"+ wrapper_host +":"+ wrapper_port +"/"+protocol, true);
					xhr.setRequestHeader("Content-Type", "application/json");
					
					xhr.onerror = function(e)
					{
						callback('', xhr.statusText);
					};
			
					xhr.onload = function()
					{
						var xmlDoc = xhr.responseText;
						var jsonResponse = JSON.parse(xmlDoc);
				
						callback(jsonResponse, '');
					}
			
					var json_data = JSON.stringify(data_dictionary);
					xhr.send(json_data);
				});
			}
			else
			{
				callback('', 'Wrapper has not registered');
			}
		}
		else
		{
			callback('', 'Missing wrapper');
		}
	}

	//Client commands
	//-------------------------------
	function receiveDataFromClient(client, wrapper_uid)
	{

		var json = client.json;
		if (config.show_performance)
		{
			console.log("Measuring action time... (" + json.action + ")");
			reset_time();
		}

		if (config.verbose) console.log("Received action: " + json.action);
		if (config.verbose) console.log("Received " + JSON.stringify(json));
		if (json.action == "getBrokerInfo")
			sendReplyToClient(client, {vendor: server_settings.get('vendor-name')});
		else if (json.action == "getLabList")
		{
			var labList = [];
			if (wrapper_uid == null)
			{
				var keys = servers_database.list();
				for (var n=0; n < keys.length; n++)
				{
					labList.push(servers_database.get(keys[n]).id);
				}
			}
			else
			{
				var found_id = wrapperForGUID(wrapper_uid);
				if (found_id)
				{
					var servers = wrapper_database.get(found_id)['server'];
					var keys = servers_database.list();

					for (var n=0; n < keys.length; n++)
					{
						var lab_id = servers_database.get(keys[n]).id;
						if (servers[lab_id] != null && servers[lab_id] == 1)
							labList.push(servers_database.get(keys[n]).id);
					}
				}
			}
			sendReplyToClient(client, labList);
		}
		else if (json.action == "registerWrapper" || json.action == "registerSimpleWrapper")
		{
			if (wrapper_uid != null) //We can assume that the wrapper has already gone through the auth checking
			{
				var found_id = wrapperForGUID(wrapper_uid);
				if (found_id)
				{
					var is_simple = (json.action == "registerSimpleWrapper") ? true : false;
					 
					var wrapper_settings = wrapper_database.get(found_id);
					wrapper_settings['host']   = json.wrapper_host;
					wrapper_settings['port']   = json.wrapper_port;
					wrapper_settings['simple'] = is_simple;
					wrapper_database.set(found_id, wrapper_settings);

					if (!is_simple)
					{
						sendActionToWrapper(wrapper_uid, {action:'confirmRegistration'}, function(data,err){
							if (data.success == true) {	
								console.log("Agent registered " + found_id + " at " + json.wrapper_host + ":" + json.wrapper_port);
								sendReplyToClient(client, {success: true});}
							else
								sendReplyToClient(client, {error: err});
						});	
					}
					else
					{
						console.log("Simple agent registered " + found_id);
						sendReplyToClient(client, {success: true});
					}
				}
			}
			else //This shouldn't be called for a client. Somebody is probably trying to mess with the broker.
			{
				sendReplyToClient(client, {error: "You do not have permission for this action"});
				return; 
			}
		}

		var error_message = error_list[json['id']];
		if (error_message)
			sendReplyToClient(client, {error: error_message});
		else
		{
			var server_id = json['id'];
			var selected_server = lab_list[server_id];

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
					{
						//Increase the experiment id number
						var server_datastore = servers_database.get(server_id);
						if (server_datastore)
						{
							var experimentID = server_datastore['next_id'];
							if (!experimentID) //Called if null or zero..
								experimentID = 0;		

							var idFunction = (function(json, client, wrapper_uid, experimentID)
							{
								return function()
								{
									//Log this message
									if (config.verbose) console.log("Submitting experiment to " + json['id']);
									if (config.verbose) console.log(json['experimentSpecification']);
		
									var submitFunction = (function(lab_id, wrapper_uid, response_client)
									{
						          		return function(obj, err)
								 		{
											//Extract the ID from the lab server
											var returnedID = obj['experimentID'];

											if (obj['vReport'][0]['accepted'] == 'true')
											{
												if (config.verbose) console.log("Experiment " + returnedID + " validated successfully");

												//Associate this experiment with the wrapper (IF a wrapper was used)
												if (wrapper_uid != null)
												{
													if (config.verbose) console.log("Associating experiment " + returnedID + " with " + wrapper_uid);
													experiment_store.set(lab_id, returnedID, wrapper_uid);

													//Flush the experiment store (to ensure all changes are kept!)
													experiment_store.flush();
												}
											}
											else
											{
												if (config.verbose) console.log("Experiment " + returnedID + " validation failed");
											}

									  	 	sendReplyToClient(response_client, obj);
						            	};
						       		})(json['id'], wrapper_uid, client);
	
									//Submit the experiment
									selected_server.submit(experimentID, json['experimentSpecification'], 'default', 0, submitFunction);
								};
				       		})(json, client, wrapper_uid, experimentID);

							//Increment the experiment database
							server_datastore['next_id'] = experimentID+1;
							servers_database.set(server_id, server_datastore, idFunction);
						}
						else
						{
							console.log("Critical database error");
						}
						break;
					}
					case "validate":
						selected_server.validate(json['experimentSpecification'], 'default', responseFunction);
						break;
					default:
						console.log("Invalid action " + json.action);
						break;
				}
			}
		}

		if (config.show_performance) elapsed_time("Action completed");
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
	root.receiveDataFromClient 		= receiveDataFromClient;
	root.sendReplyToClient 			= sendReplyToClient;
	root.flushServers 				= flushServers;
	root.wrappers 					= wrapper_database;

	if (config.show_performance) elapsed_time("Setup complete!");
});
}
exports.start = start;