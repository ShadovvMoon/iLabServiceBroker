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

var crypto = require('crypto');
var express = require('express');
var override = require("./override");
var Store = require('ministore')('database');
var configuration = Store('config');
var portscanner = require('portscanner');
var readline = require('readline');
var dom = require('domain');

fs = require('fs');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/*
process.on('uncaughtException', function(err) {
    console.log('Threw Exception: ', err);
});
*/

XMLHttpRequest = require('xhr2');//require("xmlhttprequest").XMLHttpRequest;
module.exports.createAgent = (function (app, callback) {
    require('crypto').randomBytes(48, function (ex, buf) {
        var secret = buf.toString('hex');
        var root = {secret: secret,
            app: app};

        root.flushSettings = function()
        {
            root.global_port = configuration.get("agent_port");
            root.is_simple = configuration.get("is_simple");
            root.agent_uid = configuration.get("agent_uid");
            root.agent_key = configuration.get("agent_key");
            root.agent_host = configuration.get("agent_host");
            root.broker_url = configuration.get("broker_url");
            root.broker_port = configuration.get("broker_port");
			root.verbose = configuration.get("verbose");
			root.show_requests = configuration.get("show_requests");
        }
        root.flushSettings();
        root.pluginSettings = {};

        const preferredLineLength = 40;

        var protocol = "wrapper-json";
        var access_denied_error = "Access denied.";
	
		root.pluginDomains = {};
		function killPlugin(pluginName)
		{
			if (pluginName in root.pluginDomains)
			{
				var existing_domain = root.pluginDomains[pluginName];
				root.pluginDomains.dispose();
				delete root.pluginDomains[pluginName];
			}
		}

		function loadPlugin(pluginName)	
		{
			killPlugin(pluginName);
			var plugin_domain = require('domain').create();

			//In the event of an error, kill or restart the plugin.
			plugin_domain.on('error', function(err){
				console.log("Plugin '" + pluginName + "' crashed");
				console.log(err);
			});

			var pluginLocation = "./plugins/" + pluginName + "/plugin.js";
			fs.exists(pluginLocation, function (exists) {
				if (exists) {
					var database = Store(pluginName);

					//Each plugin will get its own domain.
					plugin_domain.run(function(){
						var plug = require(pluginLocation);
						plug.setupPlugin(root, database);
					});
				}
				else
				{
					console.log("plugin.js is missing for plugin '"+pluginName+"'");
				}
			});
		}
	
        function sendSetupToServer(host, port, data_dictionary, callback) {
            var xhr = new XMLHttpRequest();

            xhr.open('post', "http://" + host + ":" + port + "/wrapper-setup", true);
            xhr.timeout = 5000;
            xhr.setRequestHeader("Content-Type", "application/json");

            xhr.ontimeout = function () {
                callback('', "Server is not responding. Request timed out.");
            }
            xhr.onerror = function (e) {
                callback('', "Server is not responding. " + xhr.statusText);
            };

            xhr.onload = function () {
                var xmlDoc = xhr.responseText;
                var jsonResponse = JSON.parse(xmlDoc);

                callback(jsonResponse, '');
            }

            var json_data = JSON.stringify(data_dictionary);
            xhr.send(json_data);
        }

        function sendActionToServer(data_dictionary, callback) {
            data_dictionary['time-stamp'] = new Date().getTime();
            data_dictionary['uid'] = root.agent_uid;
            data_dictionary['token'] = '';

            var dictionaryAttribute = JSON.stringify(data_dictionary);
            var computedSignature = hmacsha1(root.agent_key, root.agent_uid + dictionaryAttribute);

            data_dictionary['token'] = computedSignature;

            var xhr = new XMLHttpRequest();
			xhr.timeout = 5000;
            xhr.open('post', "http://" + root.broker_url + ":" + root.broker_port + "/" + protocol, true);
            xhr.setRequestHeader("Content-Type", "application/json");

            xhr.onerror = function (e) {
                callback('', xhr.statusText);
            };
            xhr.ontimeout = function (e) {
                callback('', "Server is not responding. Request timed out.");
            };
            xhr.onload = function () {
                var xmlDoc = xhr.responseText;
                var jsonResponse = JSON.parse(xmlDoc);

                callback(jsonResponse, '');
            }

            var json_data = JSON.stringify(data_dictionary);
            xhr.send(json_data);
        }

        root.sendActionToServer = sendActionToServer;
        function hmacsha1(key, text) {
            return crypto.createHmac('sha1', key).update(text).digest('base64')
        }

        function sendReplyToClient(client, data_dictionary) {
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

        root.sendReplyToClient = sendReplyToClient;
        function rejectDataFromClient(client) {
            if (client.json.action == "submit") {
                return sendReplyToClient(client, {
                    vReport: {
                        accepted: false
                    }
                });
            }
            else if (client.json.action == "submit") {
                return sendReplyToClient(client, {
                    accepted: false,
                    estRuntime: "0"
                });
            }
            return sendReplyToClient(client, {error: "Your request was rejected by the server"});
        }

        root.rejectDataFromClient = rejectDataFromClient;
        function receiveDataFromClient(client) {
            var user = client.json['uid'];
            if (client.json.experimentID != null) //TODO: Add check for action
            {
                if (user != null) {
                    if (client.json.action == "submit") {
                        var responseFunction = (function (response_client) {
                            return function (obj, err) {
                                //Associate the returned experiment with the user id
                                if (root.verbose) console.log(JSON.stringify(obj));

                                //Reply to the client
                                sendReplyToClient(response_client, obj);
                            };
                        })(client);
                        sendActionToServer(client.json, responseFunction);
                    }
                    else {
                        //Check whether this experiment was submitted by this user (or if they have sufficient privlidges to do this action)
                        if (client.json.action == "retrieveResult") {
                            var responseFunction = (function (response_client) {
                                return function (obj, err) {
                                    if (root.verbose) console.log(JSON.stringify(obj));
                                    sendReplyToClient(response_client, obj);
                                };
                            })(client);
                            sendActionToServer(client.json, responseFunction);
                        }
                        else {
                            //Pass this action through to the server
                            var responseFunction = (function (response_client) {
                                return function (obj, err) {
                                    sendReplyToClient(response_client, obj);
                                };
                            })(client);
                            sendActionToServer(client.json, responseFunction);
                        }
                    }
                }
                else return console.log("Invalid user (null)");
            }
            else {
                var responseFunction = (function (response_client) {
                    return function (obj, err) {
                        sendReplyToClient(response_client, obj);
                    };
                })(client);
                sendActionToServer(client.json, responseFunction);
            }
        }

        root.receiveDataFromClient = receiveDataFromClient;
        function isAuthenticated(req) {
            if (root.verbose) console.log("Checking authentication");
            if (req) {
                var uid = req['uid'];
                var token = req['token'];

                if (uid && token) {
                    var computedSignature = hmacsha1(secret, uid);
                    computedSignature = computedSignature.split("+").join(" ");
                    token = token.split("+").join(" ");

                    if (computedSignature == token) {
                        if (root.verbose) console.log("Authentication successful");
                        return true;
                    }
                    else {
                        if (root.verbose) console.log("Javascript authentication failed (" + uid + "). Incorrect signature: " + computedSignature + " should be " + token);
                    }
                }
                else {
                    if (root.verbose) console.log("Javascript authentication failed (" + uid + "). Missing UUID or Token.");
                }
            }
            if (root.verbose) console.log("Missing request");
            return false;
        }

        root.isAuthenticated = isAuthenticated;
        function javascriptToken(uid) {
            var computedSignature = hmacsha1(secret, uid);
            var JS_Script = '<script type="text/javascript">var token_string = {u:"' + uid + '",t:"' + computedSignature + '"};var agent_host = "' + root.agent_host + '";var agent_port = "' + root.global_port /*config.wrapper_port*/ + '";</script>';
            return JS_Script;
        }

        function tokenDictionary(uid) {
            var computedSignature = hmacsha1(secret, uid);
            return {uid: uid, hash: computedSignature};
        }

        root.tokenDictionary = tokenDictionary;
        root.javascriptToken = javascriptToken;
        function startMessage() {
            console.log("");
            console.log("iLab Agent");
            console.log("Version: 1.1");
            console.log("  Build: 1");
            console.log("   Date: 5/7/2014");
            printSeparator();
        }

        function setupExpress(secret) {
            var passport = require("passport");
            var path = require('path');

	        // Domain on every request
	        app.use(function(req, res, next) {
				var domain = dom.create();
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
		 
			//app.use(require('express-domain-middleware'));
            app.set('port', root.global_port);//config.wrapper_port);
            if (root.show_requests) {
                app.use(express.logger("dev"));
            }
            app.use(express.cookieParser());
            app.use(express.bodyParser());

            var cookieName = 'agentCookies' + root.global_port;
            app.use(express.session({secret: secret, key: cookieName}));

            app.use(passport.initialize());
            app.use(passport.session());
            app.use(express.methodOverride());
            app.use(app.router);
            app.use('/public', express.static(path.join(__dirname, 'public')));
	
			if (root.show_requests) {
           	 	app.use(express.logger());
			}
        }

        function printDots(dotNum)
        {
            var d = 0;
            for (d = 0; d < dotNum; d++) {
                setupConsole(".");
            }
        }
		function flushPlugins(callback) {
            fs.readdir("./plugins", function (err, files) {
                if (err) {
	                console.log("Unable to read plugins folder");
                    return console.log(err);
                }
				files = removeHiddenFiles(files);
				var loaded_plugins = Object.keys(root.pluginSettings);
				var i;
				for (i=0;i<files.length;i++)
				{
					var plugin_name = files[i];
					if (loaded_plugins.indexOf(plugin_name) == -1)
					{
						//console.log("Discovered new plugin '" + plugin_name + "'");
						root.pluginSettings[plugin_name] = {enabled:false};
					}
				}
				configuration.set("plugins", root.pluginSettings);
				callback();
            });
		}
        function setupPlugins(secret) {
            var k = 0;

            console.log("Loading plugins");

            root.pluginSettings = configuration.get("plugins");
            var plugins = Object.keys(root.pluginSettings);
            for (k = 0; k < plugins.length; k++) {
                var plugin_name = plugins[k];

                setupConsole(plugin_name);

                if (root.pluginSettings[plugin_name].enabled)
                {
                    var dotNum = preferredLineLength - plugin_name.length-6;
                    printDots(dotNum);

					loadPlugin(plugin_name);
			
					/*
                    var database = Store(plugin_name);
                    var plug = require("./plugins/" + plugin_name + "/plugin.js");
                    plug.setupPlugin(root, database);
                    
					*/	
					setupConsole("loaded\n");
                }
                else
                {
                    var dotNum = preferredLineLength - plugin_name.length-8;
                    printDots(dotNum);

                    setupConsole("disabled\n");
                }
            }
            console.log("");
        }

        function startServer(callback) {
            require("http").createServer(app).listen(app.get('port'), function () {
                callback();
            });
        }

        function clearConsole() {
            var lines = process.stdout.getWindowSize()[1];
            for (var i = 0; i < lines; i++) {
                console.log('\r\n');
            }
        }

        clearConsole();
        startMessage();


        //Setup functions
        function setupConsole(message) {
            process.stdout.write(message);
        }

        function setupYes(entry) {
            var trimmed = entry.trim();
            return (trimmed.indexOf("y") == 0);
        }

        var currentSetupPlugin = 0;
        var setupPluginList = [];
        function setupNextPlugin() {
            if (currentSetupPlugin < setupPluginList.length) {
                var currentPlugin = setupPluginList[currentSetupPlugin];
                currentSetupPlugin++;

                var pluginLocation = "./plugins/" + currentPlugin + "/plugin.js";
                fs.exists(pluginLocation, function (exists) {
                    if (exists) {
                        rl.question("Enable " + currentPlugin + " (y/n)? ", function (enablePlugin) {
                            if (setupYes(enablePlugin)) {
                                //Load the plugin
                                setupConsole("Loading " + currentPlugin + "...");

                                var database = Store(currentPlugin);
                                var plug = require(pluginLocation);
                                setupConsole("success.\n");

                                if (typeof(plug.setupGUI) === "function") {
                                    plug.setupGUI(rl, database, function (setupNextPlugin) {
                                        return function () {
                                            console.log(currentPlugin + " was setup successfully.");

                                            if (typeof(plug.setupPlugin) === "function") {
											
												loadPlugin(currentPlugin);

                                                //plug.setupPlugin(root, database);
                                                root.pluginSettings[currentPlugin] = {enabled: true};
                                                return setupNextPlugin();
                                            }
                                            else {
                                                console.log("Plugin is broken. Skipping.");
                                                root.pluginSettings[currentPlugin] = {enabled: false};
                                                return setupNextPlugin();
                                            }
                                        }
                                    }(setupNextPlugin));
                                }
                                else //Plugin does not require a setup
                                {
                                    if (typeof(plug.setupPlugin) === "function") {

										loadPlugin(currentPlugin);
                                        //plug.setupPlugin(root, database);
                                        root.pluginSettings[currentPlugin] = {enabled: true};
                                        return setupNextPlugin();
                                    }
                                    else {
                                        console.log("Plugin is broken. Skipping.");
                                        root.pluginSettings[currentPlugin] = {enabled: false};
                                        return setupNextPlugin();
                                    }
                                }
                            }
                            else {
                                root.pluginSettings[currentPlugin] = {enabled: false};
                                return setupNextPlugin();
                            }
                        });
                    } else {
                        //setupConsole("failed.\n");
                        //console.log("plugin.js is missing. Skipping.");
                        root.pluginSettings[currentPlugin] = {enabled: false};
                        return setupNextPlugin();
                    }
                });
            }
            else //No more plugins!
            {
                configuration.set("plugins", root.pluginSettings);
                configuration.set("setup_complete", true);
                console.log(" ");
                console.log("Agent setup complete!");
            }
        }

		function removeHiddenFiles(files)
		{
			var i;
			for (i=0; i < files.length; i++)
			{
				if (files[i].indexOf('.') == 0)
				{
					files.splice(i, 1);
					i--;
				}
			}
<<<<<<< HEAD
			return files;
=======
			if (config.verbose) console.log("Missing request");
			return false;
		}	
		root.isAuthenticated = isAuthenticated;
		function javascriptToken(uid)
		{
			var computedSignature = hmacsha1(secret, uid);
			var JS_Script = '<script type="text/javascript">var token_string = {u:"'+uid+'",t:"'+computedSignature+'"};var agent_host = "' + config.wrapper_host + '";var agent_port = "' + config.wrapper_port + '";</script>';
			return JS_Script;
		}	
		function tokenDictionary(uid)
		{
			var computedSignature = hmacsha1(secret, uid);
			return {uid:uid,hash:computedSignature};
		}	
		root.tokenDictionary = tokenDictionary;
		root.javascriptToken = javascriptToken;
		function startMessage()
		{
			console.log("");
			console.log("iLab agent");
			console.log("Version: 1.0");
			console.log("  Build: 3");
			console.log("   Date: 12/2/2014");
			console.log("");
>>>>>>> FETCH_HEAD
		}

        function setupAllowedPlugins() {
            setupConsole("Finding plugins...");
            fs.readdir("./plugins", function (err, files) {
                if (err) {
                    setupConsole("failed\n");
                    return console.log(err);
                }
                setupConsole("success\n");
                console.log("For each of the plugins below, type 'y' to enable it.");
                currentSetupPlugin = 0;
                setupPluginList = removeHiddenFiles(files);
                setupNextPlugin();
            });
        }

        function setupPromtSimpleAgent() {
            rl.question("Does this agent need experiment results (y/n)? ", setupSimpleAgent);
        }

        function setupSimpleAgent(simpleAnswer) {
            if (setupYes(simpleAnswer)) {
                rl.question("Agent Host: ", function (agent_hostname) {
                    root.agent_host = agent_hostname;
					configuration.set("agent_host", root.agent_host);

                    setupConsole("Attempting to register full agent with service broker...");
                    root.is_simple = false;
                    configuration.set("is_simple", false);

                    registerBroker(function (data, err) {
                        if (err) {
                            setupConsole("failed\n");
                            console.log(err);
                            setupPromptAgentRegistration();
                        }
                        else if (data.error) {
                            setupConsole("failed\n");
                            console.log(data.error);
                            setupPromptAgentRegistration();
                        } else if (!data) {
                            setupConsole("failed\n");
                            console.log("The service broker is not responding.");
                            setupPromptAgentRegistration();
                        } else {
                            setupConsole("success\n");
                            setupAllowedPlugins();
                        }
                    })
                });
            }
            else //Skip the non-simple setup
            {
                setupAllowedPlugins();
                configuration.set("is_simple", true);
            }
        }

        function setupPromptAgentRegistration() {
            rl.question("Agent GUID: ", setupAgentRegistration);
        }

        function setupAgentRegistration(agent_guid) {
            root.agent_uid = agent_guid;
            configuration.set("agent_uid", root.agent_uid);
            rl.question("Agent Passkey: ", function (agent_pkey) {
                root.agent_key = agent_pkey;
                configuration.set("agent_key", root.agent_key);

                setupConsole("Attempting to register simple agent with service broker...");
                root.is_simple = true;
                registerBroker(function (data, err) {
                    if (err) {
                        setupConsole("failed\n");
                        console.log(err);
                        setupPromptAgentRegistration();
                    }
                    else if (data.error) {
                        setupConsole("failed\n");
                        console.log(data.error);
                        setupPromptAgentRegistration();
                    } else {
                        setupConsole("success\n");
                        setupPromtSimpleAgent();
                    }
                });
            });
        }

        function setupPromptBroker() {
            rl.question("Broker Host: ", setupBrokerURL);
        }

        function setupBrokerURL(broker_url) {
            var brokerFound = function (json) {
                setupConsole("available\n");
                console.log("Broker vendor: " + json['vendor']);
                rl.question("Is this correct (y/n)? ", function (vendorValid) {
                    if (setupYes(vendorValid)) {
                        root.broker_url = broker_url;
                        configuration.set('broker_url', broker_url);

                        setupPromptAgentRegistration();
                    }
                    else {
                        return setupPromptBroker();
                    }
                });
            };

            rl.question("Broker Port: ", function (brokerPort) {
                root.broker_port = brokerPort;
                configuration.set('broker_port', brokerPort);

                setupConsole("Testing connection to " + broker_url + ":" + brokerPort + "...");
                sendSetupToServer(broker_url, brokerPort, {action: "ping"}, function (json, status) {
                    if (status) {
                        setupConsole("unavailable\n");
                        console.log(status);
                        return setupPromptBroker();
                    }

                    if (json['success'] == true) {
                        brokerFound(json);
                    }
                    else if (json['success'] == false) {
                        setupConsole("available\n");
                        console.log("Broker server is being uncooperative. Check with the owner.");
                        console.log("Error: " + json['error']);
                        return setupPromptBroker();
                    }

                });
            });
        }

        function setupAgentStart() {
            setupConsole("available\nStarting server...");
            root.global_port = configuration.get("agent_port");
            setupExpress(secret);
            startServer(function () {
                setupConsole("success\n");
                return setupPromptBroker();
            });
        }

        function setupAgentPrompt() {
            rl.question("Port (for this agent): ", setupAgentPort);
        }

        function setupAgentPort(agent_port) {
            var continueFunction = function (port_number) {

                //Store this port
                configuration.set("agent_port", port_number);

                //Check whether the port is valid
                setupConsole("Checking port " + port_number + "...");
                portscanner.checkPortStatus(port_number, '127.0.0.1', function (error, status) {
                    // Status is 'open' if currently in use or 'closed' if available
                    if (error)
                        console.log(error);

                    if (status == 'open') {
                        setupConsole("unavailable.\n");
                        return setupAgentPrompt();
                    }
                    else {
                        setupAgentStart();
                    }
                });
            };
            if (agent_port == '') {
                setupConsole("Finding port...");
                return portscanner.findAPortNotInUse(2000, 20000, '127.0.0.1', function (error, port) {
                    if (error) {
                        setupConsole("failed.\n");
                        return setupAgentPrompt();
                    }
                    setupConsole("" + port + "\n");
                    return continueFunction(parseInt(port));
                })
            }
            else if (agent_port == 'skip') {
                setupConsole("Skipping port check -> assuming port is ");
                return setupAgentStart();
            }
            return continueFunction(parseInt(agent_port));
        }

        function setupAgent() {
            //Does the agent need to be setup?
            var setup_complete = configuration.get("setup_complete");
            if (setup_complete != true) {
                rl.question("Press enter to begin Agent setup.", function (answer) {
                    rl.question("Port (for this agent): ", setupAgentPort);
                });
                return false;
            }
            return true;
        }
        function registerAgent(success, failure)
        {
            setupConsole("Connecting to service broker...");
            registerBroker(function (data, err) {
                if (err) {
                    setupConsole("failed\n");
                    console.log(err);
                    failure();
                }
                else if (data.error) {
                    setupConsole("failed\n");
                    console.log(data.error);
                    failure();
                } else if (!data) {
                    setupConsole("failed\n");
                    console.log("The service broker is not responding");
                    failure();
                } else {
                    setupConsole("success\n");
                    success();
                }
            })
        }

        function commandlineGUI()
        {
            rl.question(">>> ", function (command) {
                var args = command.split(" ");

                if (args[0] == "help")
                {
                    console.log("commands");
                    console.log("   connect - connect to the broker");
                    console.log("   test - get some details about this agent from the broker");
                    console.log(" ");
					console.log("   stop - stop the agent");
					console.log(" ");
                    console.log("   set [key] [value] - modify configuration settings");
                    console.log("   get [key] - retrieve configuration settings");
                    console.log("   config - retrieve all configuration settings");
                    console.log(" ");
                    console.log("   plugins - show a list of plugins");
                    console.log("   enable [plugin] - enable a plugin");
                    console.log("   disable [plugin] - disable a plugin (requires server restart)");
                    console.log("   config [plugin] - retrieve all configuration settings for a plugin");
                    console.log("   set [plugin] [key] [value] - modify configuration settings for a plugin");
                    console.log("   get [plugin] [key] - retrieve configuration settings for a plugin");
                    console.log(" ");
                    console.log("configuration keys");
					console.log("   is_simple     - [true/false]");
					console.log("   agent_host    - agent hostname");
					console.log("   agent_port    - agent port");
					console.log("   agent_uid     - agent guid");
					console.log("   agent_key     - agent passkey");
					console.log("   broker_url    - broker hostname");
					console.log("   broker_port   - broker port");
					console.log("   verbose       - show verbose logging");
					console.log("   show_requests - show express requests");
      			}
				else if (args[0] == "plugins") {
					return flushPlugins(function(){
			            root.pluginSettings = configuration.get("plugins");
			            var plugins = Object.keys(root.pluginSettings);
			            for (k = 0; k < plugins.length; k++) {
			                var plugin_name = plugins[k];
			
			                setupConsole(plugin_name);
			
			                if (root.pluginSettings[plugin_name].enabled)
			                {
			                    var dotNum = preferredLineLength - plugin_name.length-7;
			                    printDots(dotNum);
			                    setupConsole("enabled\n");
			                }
			                else
			                {
			                    var dotNum = preferredLineLength - plugin_name.length-8;
			                    printDots(dotNum);
			                    setupConsole("disabled\n");
			                }
			            }
						commandlineGUI();
					});
				}
                else if (args[0] == "test") {
                    return sendActionToServer({
                                  action: "getAgentInfo"
                        }, function (data, err) {
                        if (err) {
                            console.log("error: " + err);
                        }
                        else if (!data.message)
                        {
                            console.log("an expected error occurred");
                        }
                        else {
                            console.log(data.message);
                        }

                        commandlineGUI();
                    });
                }
                else if (args[0] == "stop") {
                    process.exit();
                }
                else if (args[0] == "connect") {
                    return registerAgent(function () {
                        printBrokerInfo();
                        commandlineGUI();
                    }, function () {
                        printBrokerInfo();
                        commandlineGUI();

                    });
                }
				else if (args[0] == "enable") {
					if (args.length == 2) {
						return flushPlugins(function(){
							var currentPlugin = args[1];
							if (Object.keys(root.pluginSettings).indexOf(currentPlugin) != -1)
							{
	
								function finishedPlugin(){
									configuration.set("plugins", root.pluginSettings);
									console.log("Restart the agent to see plugin changes.");
									commandlineGUI();
								}
	
								var pluginLocation = "./plugins/" + currentPlugin + "/plugin.js";
								fs.exists(pluginLocation, function (exists) {
                    			if (exists) {
									var database = Store(currentPlugin);
		                            var plug = require(pluginLocation);
		
		                            if (typeof(plug.setupGUI) === "function") {
		                                plug.setupGUI(rl, database, function (finishedPlugin) {
		                                    return function () {
		                                        console.log(currentPlugin + " was setup successfully.");
		
		                                        if (typeof(plug.setupPlugin) === "function") {
													loadPlugin(currentPlugin);
		                                            //plug.setupPlugin(root, database);
		                                            root.pluginSettings[currentPlugin] = {enabled: true};
		                                            return finishedPlugin();
		                                        }
		                                        else {
		                                            console.log("Plugin is broken.");
		                                            root.pluginSettings[currentPlugin] = {enabled: false};
		                                            return finishedPlugin();
		                                        }
		                                    }
		                                }(finishedPlugin));
		                            }
		                            else //Plugin does not require a setup
		                            {
		                                if (typeof(plug.setupPlugin) === "function") {
											loadPlugin(currentPlugin);
		                                    //plug.setupPlugin(root, database);
		                                    root.pluginSettings[currentPlugin] = {enabled: true};
		                                    return finishedPlugin();
		                                }
		                                else {
		                                    console.log("Plugin is broken.");
		                                    root.pluginSettings[currentPlugin] = {enabled: false};
		                                    return finishedPlugin();
		                                }
		                            }
								}
								else
								{
									console.log("Plugin '" + currentPlugin + "' is broken. Missing plugin.js");     
									commandlineGUI();  
								}
								});
							}
							else
							{
								console.log("Invalid plugin '" + currentPlugin + "'");     
								commandlineGUI();            
							}
						});
                    } else {
                        console.log("invalid arguments. 1 argument expected (had " + args.length-1 + ")");
                    }
				}
				else if (args[0] == "disable") {
					if (args.length == 2) {
						return flushPlugins(function(){
							var pluginName = args[1];
							if (Object.keys(root.pluginSettings).indexOf(pluginName) != -1)
							{
								root.pluginSettings[pluginName].enabled = false;
								configuration.set("plugins", root.pluginSettings);
								killPlugin(pluginName);
								console.log("Restart the agent to see plugin changes.");
							}
							else
							{
								console.log("Invalid plugin '" + pluginName + "'");                 
							}
							commandlineGUI();   
						});
                    } else {
                        console.log("invalid arguments. 1 argument expected (had " + args.length-1 + ")");
                    }
				}
                else if (args[0] == "set") {
                    if (args.length == 3) {
                        var key = args[1];
                        var value = args[2];
                        configuration.set(key,value);
                        console.log(key + ": " + configuration.get(key));
                        root.flushSettings();
                    } else if (args.length == 4) {
			
						//Is this a plugin?
						var pluginName = args[1];
						if (Object.keys(root.pluginSettings).indexOf(pluginName) != -1)
						{
							var database = Store(args[1]);
							var key = args[2];
                        	var value = args[3];

							configuration.set(key,value);
                       	 	console.log(key + ": " + configuration.get(key));
							console.log("Restart the agent to see plugin changes.");
						}
						else
						{
							console.log("Invalid plugin '" + pluginName + "'");                 
						}


                        
                        
                    } else {
                        console.log("invalid arguments. 2 arguments expected (had " + args.length-1 + ")");
                    }
                }
                else if (args[0] == "get") {
                    if (args.length == 2) {
                        var key = args[1];
                        console.log(key + ": " + configuration.get(key));
                    } else if (args.length == 4) {

						//Is this a plugin?
						var pluginName = args[1];
						if (Object.keys(root.pluginSettings).indexOf(pluginName) != -1)
						{
							var database = Store(args[1]);
							var key = args[2];
                        	console.log(key + ": " + database.get(key));
						}
						else
						{
							console.log("Invalid plugin '" + pluginName + "'");                 
						}

                        
                    } else {
                        console.log("invalid arguments. 1 argument expected (had " + args.length-1 + ")");
                    }
                }
                else if (args[0] == "config") {
					if (args.length == 1) {
                    	console.log(configuration.all());
					} else if (args.length == 2) {

						//Is this a plugin?
						var pluginName = args[1];
						if (Object.keys(root.pluginSettings).indexOf(pluginName) != -1)
						{
							var database = Store(args[1]);
							console.log(database.all());
						}
						else
						{
							console.log("Invalid plugin '" + pluginName + "'");                 
						}
						
					}
                }
                else
                {
                    console.log("Type 'help' for command information.");
                }
                commandlineGUI();
            });
        }

        function printSeparator()
        {
            var dotNum = preferredLineLength;
            var d = 0;
            for (d = 0; d < dotNum; d++) {
                setupConsole("-");
            }
            console.log(" ");
        }
        function printBrokerInfo()
        {
            console.log(" ");
            console.log("Broker information:");
            console.log("   Host: " + root.broker_url);
            console.log("   Port: " + root.broker_port);
        }
        if (setupAgent()) {
            setupExpress(secret);
            setupPlugins(secret);
            startServer(function () {

                console.log("Running on port " + app.get('port'));
                registerAgent(function(){
                    printBrokerInfo();
                    printSeparator();
                    commandlineGUI();
                    callback(root);
                }, function(){
                    printBrokerInfo();
                    printSeparator();
                    commandlineGUI();
                });
            });
        }

        app.get('/jsonp', function (req, res) {
            if (isAuthenticated(req.query)) {
                override.receiveDataFromClient(root, {
                    request: req,
                    response: res,
                    json: req.query,
                    type: 'jsonp'
                });
            }
        });
        app.post('/json', function (req, res) {
            if (isAuthenticated(req.body)) {
                override.receiveDataFromClient(root, {
                    request: req,
                    response: res,
                    json: req.body,
                    type: 'json'
                });
            }
        });
        root.receiveDataFromClient = receiveDataFromClient;
        function isDownstreamAuthenticated(req) {
            if (req) {
                var current_time = new Date().getTime(); //in ms
                var token = req['token'];
                var time_stamp = req['time-stamp'];
                var server_secret = req['secret'];
                req['token'] = '';
                if (token) {
                    var dictionaryAttribute = JSON.stringify(req);
                    var computedSignature = hmacsha1(root.agent_key, root.agent_uid + dictionaryAttribute);
                    if (computedSignature == token) {
                        if (current_time - time_stamp < 10000 && current_time - time_stamp >= 0 && server_secret != '') {
                            var requested_action = req['action'];
                            return true;
                        }
                        else if (root.verbose)
                            console.log("Authentication failed - timeout (" + (current_time - time_stamp) / 1000 + ")");
                    }
                    else if (root.verbose)
                        console.log("Authentication failed - invalid signature");
                }
            }
            return false;
        }

        app.get('/reply-jsonp', function (req, res) {
            var client = {request: req,
                response: res,
                json: req.query,
                type: 'jsonp'};
            if (isDownstreamAuthenticated(req.query)) receiveDataFromServer(client);
            else sendReplyToClient(client, {error: access_denied_error});
        });
        app.post('/reply-json', function (req, res) {
            var client = {request: req,
                response: res,
                json: req.body,
                type: 'json'};
            if (isDownstreamAuthenticated(req.body)) receiveDataFromServer(client);
            else sendReplyToClient(client, {error: access_denied_error});
        });
        function receiveDataFromServer(client) {
            var json = client.json;
            if (json.action == 'confirmRegistration') {
                sendReplyToClient(client, {success: true});
            }
            if (json.action == 'notify') {

				console.log(" ");
				console.log("notification from '"+ json['labID'] +"'");
				console.log("   experiment completed: " + json['experimentID']);

				override.experimentCompleted(root, json['labID'], json['experimentID']);
                sendReplyToClient(client, {success: true});
            }
        }

        function registerBroker(function_callback) {
            if (root.is_simple == 'false' || ! root.is_simple)
            {
				 sendActionToServer({action: "registerWrapper", wrapper_host: root.agent_host, wrapper_port: root.global_port /*config.wrapper_port*/}, function (data, err) {
                    function_callback(data, err);
                });
            }
            else {
               sendActionToServer({action: "registerSimpleWrapper", wrapper_host: root.agent_host, wrapper_port: root.global_port /*config.wrapper_port*/}, function (data, err) {
                    function_callback(data, err);
                });
            }
        }


    });
});