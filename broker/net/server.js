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
http = require("http");
crypto = require('crypto')
adminui = require("./admin");
soap = require("./soap");
experiment_store = require("./data.js");
config = require('../config')
express = require('express');
path = require('path');
fs = require('fs');
database = require('./database');

var app = express();
var plugin_list = {};

//Timing functions
var start_time = process.hrtime();
var reset_time = function () {
    start_time = process.hrtime(); // reset the timer
}
var elapsed_time = function (note) {
    var precision = 3; // 3 decimal places
    var elapsed = process.hrtime(start_time)[1] / 1000000; // divide by a million to get nano to milli
    console.log(process.hrtime(start_time)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    start_time = process.hrtime(); // reset the timer
}

//Error handling
/*process.on('uncaughtException', function(err)
 {
 // handle the error safely
 console.error('An uncaughtException was found.');
 console.log(err);
 });*/

//Authentication schemes
passport = require("passport");
LocalStrategy = require('passport-local').Strategy;
ConsumerStrategy = require('../node_modules_modified/passport-http-2legged-oauth').Strategy;

//Communication
XMLHttpRequest = require("xhr2").XMLHttpRequest;

//Passport
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

passport.use(new LocalStrategy
(
    function (username, password, done) {
        var selected_user = database.valueForKey("users", username, undefined);
        if (selected_user) {
            var salt = database.valueForKey("settings", 'server-salt', undefined);
            var shasum = crypto.createHash('sha1');
            shasum.update(salt);
            shasum.update(password);
            var d = shasum.digest('hex');

            if (selected_user['hash'] == d)
                return done(null, {id: selected_user['id'], username: username, hash: d});
            else
                return done(null, false, { message: 'Incorrect password.' });
        }
        else
            return done(null, false, { message: 'Incorrect username.' });
    }
));

/**
 * Creates a random string
 * @returns {string} - random string
 */
function createUUID() {
    var random_uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
        function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : r & 0x3 | 0x8;
            return v.toString(16);
        });
    return random_uuid;
}

/**
 * Checks whether a setting has been initialised. If not, sets it to a random string.
 * @param name - the setting to check
 * @returns {*} - the value for the setting
 */
function getSettingUUID(name) {
    if (database.getKeys("settings").indexOf(name) == -1)
        database.setValueForKey("settings", name, createUUID(), undefined);
    return database.valueForKey("settings", name);
}

/**
 * Returns the random security salt
 * @returns {*} - salt
 */
function getSalt() {
    return getSettingUUID('server-salt');
}

/**
 * Returns the unique identifier for this broker
 * @returns {*} - broker guid
 */
function getGUID() {
    return getSettingUUID('vendor-guid');
}

/**
 * Creates a new lab server object using the settings in the database.
 * @param server_number - the index of the server to load
 * @private
 */
root._loadServer = function(server_number) {

    var server_id = database.getKeys("servers")[server_number];
    var advanced_log_file = 'logs/'+server_id+'.log';
    fs.unlink(advanced_log_file, function (server_id, advanced_log_file) {
        return function(err)
        {
            var logStream = fs.createWriteStream(advanced_log_file, {flags: 'a'});

            var server_data = database.valueForKey("servers", server_id, undefined);
            var server_type = server_data['type'];
            server_type = (typeof server_type !== 'undefined') ? server_type : "legacy";
            server_data['guid'] = getGUID();
            try {
                var lab = require("./labs/" + server_type);
                new lab.iLabServer(server_data, logStream, (function (root) {
                    return function (lab_server) {
                        var responseFunction = (function (root, server, lab_server) {
                            return function (xml, err) {
                                if (err) {
                                    root.error_list[server.id] = err;
                                    console.log("ERROR: " + server.id + ", " + err);
                                }
                                else {
                                    root.lab_list[server.id] = lab_server;
                                    root.error_list[server.id] = xml['labStatusMessage'];
                                    console.log("Status " + JSON.stringify(xml));

                                    //Get the photo
                                    var responseFunction = (function (root, server) {
                                        return function (xml, err) {
                                            if (!err)
                                            {
                                                root.lab_configurations[server.id] = xml;
                                            }
                                        };
                                    }(root, server_data));
                                    lab_server.getLabConfiguration(responseFunction);
                                }
                            };
                        }(root, server_data, lab_server));
						lab_server.registerBroker(config.host, config.port, function(lab_server, server_id){
							return function(json, err){
								var server_data = database.valueForKey("servers", server_id, undefined);
								server_data.guid = json.labGUID;
								database.setValueForKey("servers", server_id, server_data, undefined);
							}
						}(lab_server, server_id));
                        lab_server.getLabStatus(responseFunction);
                    };
                }(module.exports)));
            }
            catch (e) {
                console.log(e.toString());
            }
        };
    }(server_id, advanced_log_file));
};

/**
 * Reload all lab server objects from the database.
 */
function flushServers() {
    root.error_list = {};
    root.lab_list = {};
    root.lab_configurations = {};
    var i;
    for (i = 0; i < database.getKeys("servers").length; i++) {
        root._loadServer(i);
    }
}

/**
 * Measure the time difference between two calls of this function.
 * @param message - the message to display along with the time it took to execute
 * @private
 */
function _timeProfile(message) {
    if (config.show_performance)
        elapsed_time(message);
}

root.getServer = function(server_id)
{
	return root.lab_list[server_id];
}

root.getErrors = function(server_id)
{
    return root.error_list[server_id];
}

root.getServerConfiguration = function(server_id)
{
    return root.lab_configurations[server_id];
}

/**
 * Starts the service broker
 */
function start() {
    _timeProfile("Creating log file hook");

    //Logging and debug information
    var log_file = 'database/debug.log';
    fs.unlink(log_file, function (err) { //Delete the old log

        /**
         * Create a hook into stdout to reroute the console output into a file.
         */
        if (err)
            console.log(err.toString());

		//Create a logs folder
		if(!fs.existsSync("logs")){
		     fs.mkdirSync("logs", 0766, function(err){
		       if(err){ 
		         console.log(err);
		         response.send("ERROR! Can't make the directory! \n");    // echo the result back
		       }
		     });   
		 }

        var logStream = fs.createWriteStream(log_file, {flags: 'a'});
        function hook_stdout(stream) {
            var old_write = process.stdout.write
            process.stdout.write = (function (write) {
                return function (string, encoding, fd) {
                    stream.write(string);
                    write.apply(process.stdout, arguments);
                }
            })(process.stdout.write)
        }
        hook_stdout(logStream);
        _timeProfile("Starting broker");

        //Start message
        //-------------------------------
        console.log("");
        console.log("iLab Broker Service");
        console.log("Version: 1.0.3");
        console.log("  Build: 3");
        console.log("   Date: 16/7/2014");
        console.log("");
        console.log("Port: " + config.port);
        _timeProfile("Setting up express");

        /**
         * Configure the express module
         * @type {*}
         */
        var salt = getSalt();
        app.configure(function () {
            app.set('port', config.port);


	        // Domain on every request
	        app.use(function(req, res, next) {
				var domain = require('domain').create();
				domain.add(req);
				domain.add(res);
				domain.run(function() {
					next();
				});
				domain.on('error', function(e) {
					console.log("A caught express error occured");
					console.log(e.stack);
					res.send('500: Internal Server Error', 500);
				});
	        });
		 

            if (config.show_requests) {
                app.use(express.logger("dev"));
            }

            var cookieName = 'broker' + config.port;
            app.use(express.cookieParser());
            app.use(express.bodyParser());
            var cookieName = 'brokerCookies' + config.wrapper_port;
            app.use(express.session({secret: salt, key: cookieName}));

            app.use(passport.initialize());
            app.use(passport.session());
            app.use(express.methodOverride());
            app.use(app.router);

            //Interface junk
            app.use(express.favicon());
            app.use(express.static(path.join(process.cwd() , 'html/public')));
            //app.use(express.static(path.join(__dirname, 'html/public')));
            app.use(express.logger());
            app.set("jsonp callback", true); //Allow JSONP requests
        });

        app.configure('development', function () {
            app.use(express.errorHandler());
        });
        _timeProfile("Loading admin hashes");

        //Load the admin UI
        //-------------------------------
        var shasum = crypto.createHash('sha1');
        shasum.update(salt);
        shasum.update('password');
        var d = shasum.digest('hex');

        if (database.getKeys('users').indexOf('admin') == -1) {
            console.log("Creating admin user");
            console.log("------------------");
            console.log("Username: admin");
            console.log("Password: password");
            console.log("------------------");

            database.setValueForKey("users", "admin", {
                role: 'admin',
                id: 1,
                hash: d
            }, undefined);
        }

        _timeProfile("Checking generic settings");

        //Create the generic settings
        //-------------------------------
        if (database.getKeys("settings").indexOf("vendor-name") == -1)
            database.setValueForKey("settings", "vendor-name", 'Default name', undefined);
        if (database.getKeys("settings").indexOf("broker-port") == -1)
            database.setValueForKey("settings", "broker-port", 8080, undefined);

        adminui.create(app, root, passport);
        _timeProfile("Loading plugins");

        //Initialise auth plugins
        //-------------------------------
        console.log("Loading authentication...");
        var k = 0;
        for (k = 0; k < config.auth_plugins.length; k++) {
            var dict = config.auth_plugins[k];
            var plug = require("./auth/" + dict.file);

            plug.createAuth(app, root);
            plugin_list[dict.name] = plug;

            console.log("Loaded " + dict.name);
        }
        console.log("");

        //Communication with clients using JSON
        //-------------------------------
        _timeProfile("Setting up reply functions");

        //Replies
        function sendReplyToClient(client, data_dictionary) {
            if (config.verbose) console.log("SENDING DATA " + JSON.stringify(data_dictionary));
            if (client.type == "json") {
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
        function receiveAdminDataFromClient(client) {
            var json = client.json;
            switch (json.action) {
                case "getBrokerLog": 	//Returns the log string for the latest run of the broker
                    var responseFunction = (function (response_client) {
                        return function (err, data) {
                            if (err)
                                return console.log(err);

                            sendReplyToClient(response_client, {log: data});
                            ;
                        };
                    })(client);
                    fs.readFile(log_file, 'utf8', responseFunction);

                    break;
                case "updatePassword":
                    var old_password = json['old'];
                    var new_password = json['new'];

                    var salt = getSalt();

                    //Check that the old password matches the user
                    var shasum = crypto.createHash('sha1');
                    shasum.update(salt);
                    shasum.update(old_password);
                    var d = shasum.digest('hex');
                    if (d == client.request.user.hash) {
                        //Update the password file
                        shasum = crypto.createHash('sha1');
                        shasum.update(salt);
                        shasum.update(new_password);
                        d = shasum.digest('hex');


                        var user_settings = database.valueForKey("users", client.request.user.username, undefined);
                        user_settings['hash'] = d;
                        database.setValueForKey("users", client.request.user.username, user_settings, undefined);

                        client.request.user.hash = d;
                        sendReplyToClient(client, {success: true});
                    }
                    else
                        sendReplyToClient(client, {success: false});
                    break;
                case "getWrappers":	//Returns all the wrapper information
                    var labList = {};
                    var keys = database.getKeys("wrappers");
                    for (var n = 0; n < keys.length; n++) {
                        labList[keys[n]] = database.valueForKey("wrappers", keys[n], undefined)
                    }
                    sendReplyToClient(client, labList);
                    break;
                case "getBrokerInfo":	//Returns an extended version of the broker info (containing GUID)

                    sendReplyToClient(client, {vendor: database.valueForKey("settings", 'vendor-name', undefined),
                        guid: getGUID()});
                    break;
                case "getLabInfo": 		//Returns all the details about a lab server
                    sendReplyToClient(client, database.valueForKey("servers", json['id'], undefined));
                    break;
                case "deleteLab":  		//Deletes a lab server
                    database.removeValueForKey("servers", json['id'], undefined);
                    break;
                default:
                    console.log("Invalid admin action: " + json.action);
            }
        }

        //Wrapper communication (consider moving this to the wrapper plugin?)
        //-------------------------------
        function wrapperForGUID(guid) //Should have used the GUID for the dictionary key...
        {
            var wraps = database.getKeys("wrappers");
            var found_id = null;
            for (var i = 0; i < wraps.length; i++) {
                if (database.valueForKey("wrappers", wraps[i], undefined)['guid'] == guid) {
                    found_id = wraps[i];
                    break;
                }
            }
            return found_id;
        }

        function hmacsha1(key, text) {
            return crypto.createHmac('sha1', key).update(text).digest('base64')
        }

        function sendActionToWrapper(guid, data_dictionary, callback) {
            var found_id = wrapperForGUID(guid);
            if (found_id != null) {
                var wrapper_settings = database.valueForKey("wrappers", found_id, undefined);

                //Check whether the wrapper has registered
                var wrapper_host = wrapper_settings['host'];
                var wrapper_port = wrapper_settings['port'];
                var protocol = "reply-json";
                if (wrapper_host && wrapper_port) {
                    require('crypto').randomBytes(48, function (ex, buf) {
                        var secret = buf.toString('hex');
                        data_dictionary['time-stamp'] = new Date().getTime();
                        data_dictionary['secret'] = secret;
                        data_dictionary['token'] = '';

                        var dictionaryAttribute = JSON.stringify(data_dictionary);
                        var computedSignature = hmacsha1(wrapper_settings['key'], guid + dictionaryAttribute);

                        data_dictionary['token'] = computedSignature;

                        var xhr = new XMLHttpRequest();
						xhr.timeout = 10000;
                        xhr.open('post', "http://" + wrapper_host + ":" + wrapper_port + "/" + protocol, true);
                        xhr.setRequestHeader("Content-Type", "application/json");

                        xhr.onerror = function (e) {
                            callback('', xhr.statusText);
                        };

                        xhr.onload = function () {
                            var xmlDoc = xhr.responseText;
                            var jsonResponse = JSON.parse(xmlDoc);

                            callback(jsonResponse, '');
                        }

                        var json_data = JSON.stringify(data_dictionary);
                        xhr.send(json_data);
                    });
                }
                else {
                    callback('', 'Wrapper has not registered');
                }
            }
            else {
                callback('', 'Missing wrapper');
            }
        }

		//Lab commands
		//-------------------------------
		function receiveDataFromLabServer(client, lab_id) {
			var json = client.json;
			if (json.action == "notify")
			{
				var experimentId = json['experimentId'];
				console.log("Experiment " + experimentId + " for lab " + lab_id + " finished");

				var localised_lab_identifier = undefined;
				var keys = database.getKeys("servers");
				for (var n = 0; n < keys.length; n++) {
				    var lid = database.valueForKey("servers", keys[n], undefined).guid;
				    if (lid == lab_id)
					{
						localised_lab_identifier = keys[n];
						break;
					}
				}

				//Did an agent submit this experiment?
				experiment_store.get(lab_id, JSON.stringify(experimentId), function(client) { return function(error, wrapper_uid){
					if (typeof wrapper_uid !== "undefined")
					{
						console.log("Finding agent with GUID " + wrapper_uid);
						var found_id = wrapperForGUID(wrapper_uid);
						if (found_id) {
							console.log("Notifying agent " + found_id); 
							
							var wrapper_data = database.valueForKey("wrappers", found_id, undefined);
							var wrapper_data_location = "http://" + wrapper_data.host + ":" + wrapper_data.port + "/broker-json";
							
							console.log(wrapper_data_location);
	                        var wrapper_settings = database.valueForKey("wrappers", found_id, undefined);
	                        if (!wrapper_settings['simple'])
							{
								if (typeof localised_lab_identifier !== 'undefined') {
									sendActionToWrapper(wrapper_uid, {action: 'notify', labID: localised_lab_identifier, experimentID: experimentId}, function (data, err) {
		                                if (data.success == true) {
		                                    console.log("Agent notified.");
		                                    return sendReplyToClient(client, {success: true});
		                                }
		                                else {
		                                    console.log("Unable to notify agent.");
											return sendReplyToClient(client, {success: false});
										}
	                           		});
								}
								else
								{
									console.log("Unknown lab id");
								}
							}
							else
							{
								console.log(found_id + " is a simple agent. We cannot send data to it.");
								return sendReplyToClient(client, {success: true});
							}
						}
					}
					else
					{
						console.log("Experiment was associated with a user client");
						return sendReplyToClient(client, {success: true});
					}
				}}(client));
			}
		}

        //Client commands
        //-------------------------------
        function receiveDataFromClient(client, wrapper_uid) {

            var json = client.json;
            if (config.show_performance) {
                console.log("Measuring action time... (" + json.action + ")");
                reset_time();
            }

            if (config.verbose) console.log("Received action: " + json.action);
            if (config.verbose) console.log("Received " + JSON.stringify(json));
            if (json.action == "getBrokerInfo")
                return sendReplyToClient(client, {vendor: database.valueForKey("settings", 'vendor-name', undefined)});
            else if (json.action == "getLabList") {
                var labList = [];
                if (wrapper_uid == null) {
                    var keys = database.getKeys("servers");
                    for (var n = 0; n < keys.length; n++) {
                        labList.push(database.valueForKey("servers", keys[n], undefined).id);
                    }
                }
                else {
                    var found_id = wrapperForGUID(wrapper_uid);
                    if (found_id) {
                        var servers = database.valueForKey("wrappers", found_id, undefined)['server'];
                        var keys = database.getKeys("servers");
                        for (var n = 0; n < keys.length; n++) {
                            var lab_id = database.valueForKey("servers", keys[n], undefined).id;
                            if (servers[lab_id] != null && servers[lab_id] == 1)
                                labList.push(database.valueForKey("servers", keys[n], undefined).id);
                        }
                    }
                }
                return sendReplyToClient(client, labList);
            }
			else if (json.action == "getAgentInfo")
			{
				if (wrapper_uid != null) //We can assume that the wrapper has already gone through the auth checking
                {
					var found_id = wrapperForGUID(wrapper_uid);
                    if (found_id) {	
                        var wrapper_settings = database.valueForKey("wrappers", found_id, undefined);
                 
						message = "Identifier: " + found_id + "\n";
						message = "Simple: " + wrapper_settings['simple'];
						message += "\n";
						message += "Lab Servers\n";

						var labServerOptions = wrapper_settings['server'];
						var labServers = Object.keys(labServerOptions);
						var i;
						for (i=0; i < labServers.length; i++)
						{
							if (labServerOptions[labServers[i]] == 1)
							{
								message += "   " + labServers[i] + "\n";
							}
						}
						message += "\n";
						message += "Actions\n";

						const dotlength = 40;
				        function createDots(dotNum)
				        {
							var str = "";
				            var d = 0;
				            for (d = 0; d < dotNum; d++) {
				                str+=".";
				            }
							return str;
				        }
		
						var labFunctionKeys = wrapper_settings['function'];
						var labFunctions = Object.keys(labFunctionKeys);
						var i;
						for (i=0; i < adminui.supportedFunctions.length; i++)
						{
							var access = "OK";
							var fnName = adminui.supportedFunctions[i];
							if (labFunctions.indexOf(fnName) != -1)
							{
								if (labFunctionKeys[fnName] != 1)
								{
									access = "DISABLED";
								}
							}
							
							var dots = createDots(dotlength-fnName.length-access.length-3);
				
							message += "   " + adminui.supportedFunctions[i] + dots+access+ "\n";
						}

						return sendReplyToClient(client, {message:message});
					}
					else
					{
						return sendReplyToClient(client, {error: "Missing GUID"});
					}
                }
                else //This shouldn't be called for a client. Somebody is probably trying to mess with the broker.
                {
                    return sendReplyToClient(client, {error: "You do not have permission for this action"});
                }
			}
            else if (json.action == "registerWrapper" || json.action == "registerSimpleWrapper") {
                if (wrapper_uid != null) //We can assume that the wrapper has already gone through the auth checking
                {
                    var found_id = wrapperForGUID(wrapper_uid);
                    if (found_id) {
                        var is_simple = (json.action == "registerSimpleWrapper") ? true : false;
                        var wrapper_settings = database.valueForKey("wrappers", found_id, undefined);
                        wrapper_settings['host'] = json.wrapper_host;
                        wrapper_settings['port'] = json.wrapper_port;
                        wrapper_settings['simple'] = is_simple;
                        database.setValueForKey("wrappers", found_id, wrapper_settings, undefined);

                        if (!is_simple) {
                            return sendActionToWrapper(wrapper_uid, {action: 'confirmRegistration'}, function(client) {return function (data, err) {
                                if (data.success == true) {
                                    console.log("Agent registered " + found_id + " at " + json.wrapper_host + ":" + json.wrapper_port);
                                    return sendReplyToClient(client, {success: true});
                                }
                                else
								{
                                    return sendReplyToClient(client, {error: err});
								}
                            }}(client));
                        }
                        else {
                            console.log("Simple agent registered " + found_id);
                            return sendReplyToClient(client, {success: true});
                        }
                    }
                }
                else //This shouldn't be called for a client. Somebody is probably trying to mess with the broker.
                {
                    return sendReplyToClient(client, {error: "You do not have permission for this action"});
                }
            }

            var server_id = json['id'];
            var error_message = root.error_list[json['id']];
            if (!(server_id in root.lab_list))
                return sendReplyToClient(client, {error: error_message});
            else {

                var selected_server = root.lab_list[server_id];
                if (selected_server) {
                    var responseFunction = (function (lab_id, response_client) {
                        return function (obj, err) {
                            return sendReplyToClient(response_client, obj);
                        };
                    })(json['id'], client);
                    switch (json.action) {
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
                            var server_datastore = database.valueForKey("servers", server_id, undefined);
                            if (server_datastore) {
                                var experimentID = server_datastore['next_id'];
                                if (!experimentID) //Called if null or zero..
                                    experimentID = 0;

                                var idFunction = (function (json, client, wrapper_uid, experimentID) {
                                    return function () {
                                        //Log this message
                                        if (config.verbose) console.log("Submitting experiment to " + json['id']);
                                        if (config.verbose) console.log(json['experimentSpecification']);

                                        var submitFunction = (function (lab_id, wrapper_uid, response_client) {
                                            return function (obj, err) {
				
												try
												{
													if (err)
													{
														console.log(err);
														return sendReplyToClient(response_client, {error: err});
													}	
													else
													{
														console.log("Returned data: " + JSON.stringify(obj));
	
		                                                //Extract the ID from the lab server
		                                                var returnedID = obj['experimentID'];
		
														var vReport = (typeof obj['vReport'][0] !== 'undefined') ? obj['vReport'][0] : obj['vReport']; 
		                                                if (vReport['accepted'] == 'true' || vReport['accepted'] == true) {
		                                                    console.log("Experiment " + returnedID + " validated successfully");
		
		                                                    //Associate this experiment with the wrapper (IF a wrapper was used)
		                                                    if (wrapper_uid != null) {
																var lab_guid = database.valueForKey("servers", server_id)['guid'];
	
		                                                       	console.log("Associating experiment " + returnedID + " for lab " + lab_guid + " with agent " + wrapper_uid);
		                                                        experiment_store.set(lab_guid, JSON.stringify(returnedID), wrapper_uid);
		
		                                                        //Flush the experiment store (to ensure all changes are kept!)
		                                                        experiment_store.flush();
																console.log("Experiment store saved.");
		                                                    }
		                                                }
		                                                else {
		                                                   	console.log("Experiment " + returnedID + " validation failed");
														}
													}
												}
												catch (err)
												{
													return console.log(err.toString());
												}
                                                

                                                return sendReplyToClient(response_client, obj);
                                            };
                                        })(json['id'], wrapper_uid, client);

                                        //Submit the experiment
                                        selected_server.submit(experimentID, json, 'default', 0, submitFunction);
                                    };
                                })(json, client, wrapper_uid, experimentID);

                                //Increment the experiment database
                                server_datastore['next_id'] = experimentID + 1;
                                database.setValueForKey("servers", server_id, server_datastore, idFunction);
                            }
                            else {
                                console.log("Critical database error");
                            }
                            break;
                        }
                        case "validate":
                            selected_server.validate(json, 'default', responseFunction);
                            break;
                        default:
                            console.log("Invalid action " + json.action);
                            break;
                    }
                }
            }
            _timeProfile("Action completed");
        }

        //Server creation
        //-------------------------------
        http.createServer(app).listen(app.get('port'), function () {
            if (config.verbose) console.log("Express server listening on port " + app.get('port'));
        });

        //Connection to Lab Servers
        //-------------------------------
        flushServers();

        //Function hooks
        //-------------------------------
        root.receiveAdminDataFromClient = receiveAdminDataFromClient;
		root.receiveDataFromLabServer = receiveDataFromLabServer;
        root.receiveDataFromClient = receiveDataFromClient;
        root.sendReplyToClient = sendReplyToClient;
        root.flushServers = flushServers;

        _timeProfile("Setup complete!");
    });
}
exports.start = start;