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

crypto 	   		= require('crypto');
express    		= require('express');
database   		= require('./database');
queue      		= require('./queue');
experiment 		= require('./experiment');
defines    		= require('./defines');
jsengine   		= require('./js_engine');
jsspec     		= require('./js_spec');
XMLHttpRequest 	= require("xhr2").XMLHttpRequest;

		
broker_module = module.exports;
broker_module.brokers  = {};

/**
 * Creates a new broker object.
 * @param guid - broker guid
 * @param key - the broker passkey
 * @param host - broker hostname
 * @param port - broker port
 * @returns broker
 */
broker_module.createBroker = function (guid, name, key, host, port, permissions)
{

    /**
     * Returns the SHA1 of the text
     * @param key
     * @param text
     * @returns encrypted_text
     */
	function hmacsha1(key, text)
	{
   		return crypto.createHmac('sha1', key).update(text).digest('base64')
	}

    //Creates the new broker object
	var new_broker;
    new_broker = new function(guid, name, key, host, port, permissions)
	{
		this._guid   = guid;
        this._name   = name;
		this._key    = key;
		this._host   = host;
		this._port   = port;
        this._client = null;
		this._permissions = permissions;

        /**
         * Returns the HTTP address for the broker
         * @param http_protocol - eg, http or https
         * @returns http_address - eg, http://lab.example.com:8080
         */
        this.http_address = function (http_protocol) {
            http_protocol = typeof http_protocol !== 'undefined' ? http_protocol : 'http';
			return http_protocol + "://" + this._host + ":" + this._port;
        };

        /**
         * Returns the hostname for the broker
         * @returns {*} - hostname
         */
        this.hostName = function() {
            return this._host;
        };

        /**
         * Returns the guid for the broker
         * @returns {*} - guid
         */
        this.getGuid = function() {
            return this._guid;
        }

        this.getName = function() {
            return this._name;
        }

        /**
         * Returns the port number for the broker
         * @returns {*} - port
         */
        this.hostPort = function()  {
            return this._port;
        };

        /**
         * Performs the MIT authorisation check on the passkey.
         * @param key - the passkey to validate
         * @returns boolean - true if the passkey is valid
         */
		this.mit_authenticate = function(key) {
			return (key == this._key);
		};

        /**
         * Performs the new authentication method
         * @param req - the client request
         * @returns boolean - true if the request is valid
         */
		this.new_authentication = function(req) {
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
							}//else defines.verbose("Authentication failed - timeout (" + (current_time-time_stamp)/1000 + ")");
						}// else defines.verbose("Authentication failed - invalid signature " + computedSignature + " " + token);
					}// else defines.verbose("Authentication failed - missing server key");
				}// else defines.verbose("Authentication failed - guid or token missing");
			}// else defines.verbose("Authentication failed - missing request");
			return false;
		};

        /**
         * Updates the broker settings
         * @param guid
         * @param key
         * @param host
         * @param port
         */
		this.update = function(guid, name, key, host, port, permissions) {

            //Remove the broker from the cache
            broker_module.removeBroker(this._guid);

            //Update the internal variables
            this._guid = guid;
            this._name = name;
            this._key  = key;
            this._host = host;
            this._port = port;
			this._permissions = permissions;

            //Update the database
            database.setValueForKey("brokers", this._guid, {
                    name: this._name,
                     key: this._key,
                    host: this._host,
                    port: this._port,
					permissions: this._permissions
                }, undefined);

            //Update the cache
            broker_module.brokers[this._guid] = this;
		};

        /**
         * Sends an error message to the broker
         * @param error
         */
        this.sendError = function (error) {
            this.sendError(error, undefined);
        };

        /**
         * Sends an error message to the broker
         * @param error
         * @param client
         * @returns boolean - true if sending the error to the broker was successful
         */
        this.sendError = function(error, client) {
            client = (typeof client !== 'undefined') ? client : this._client;
            defines.verbose(error);
            return this.sendData({'error':error}, client);
        };

        /**
         * Send a javascript dictionary to the broker.
         * @param data - javascript dictionary to send to the broker
         * @returns boolean - successful
         */
        this.sendData = function(data) {
            return this.sendData(data, undefined);
        };

        /**
         * Replies to a current request with a javascript dictionary.
         * @param data - javascript dictionary to send to the broker
         * @param client
         * @returns boolean - successful
         */
        this.sendData = function(data, client) {
            client = (typeof client !== 'undefined') ? client : this._client;
            if (typeof client !== 'undefined' && client != null && client.type  == 'json') {

                this._client = undefined; //We are finished with this client.

                //Convert the data into a json string
                var json_string = JSON.stringify(data);
                client.response.writeHead(200, {'Content-Type': 'application/json'});
                client.response.write(json_string);
                client.response.end();

                defines.debug("Sending data to broker (" + this._guid + ")");
                defines.debug(json_string);

                return true;
            } else {
		
				if (data['action'] != 'notify')
				{
    				defines.verbose("Cannot send data to client for Broker " + this._guid);
                	return false;
				}

				defines.verbose("Sending data to broker");

                //Initiate a new connection to the broker. This is only used for the notify action.
                var serverGuid = database.valueForKey("settings", "guid", undefined);
				
				data['time-stamp'] = new Date().getTime();
				data['uid'] = serverGuid;
				data['token'] = '';

				var dictionaryAttribute = JSON.stringify(data);
				var computedSignature = hmacsha1(this._key, serverGuid+dictionaryAttribute);
				data['token'] = computedSignature;

				var broker_location = this.http_address() + "/lab-json";

				var xhr = new XMLHttpRequest();
				xhr.timeout = 10000;
		        xhr.open('post', broker_location, true);
		        xhr.setRequestHeader("Content-Type", "application/json");
		
		        if (typeof callback !== 'undefined')
		        {
		            xhr.onerror = function (e) {
		                callback('', xhr.statusText);
		            };
		
		            xhr.onload = function () {
		                callback(xhr.responseText, '');
		            }
		        }
		
				defines.verbose(broker_location);

				var json_data = JSON.stringify(data);
				defines.verbose(json_data);
		        xhr.send(json_data);
            
            }
        };

        /**
         * Called when this broker sends data to us
         * @param client [OPTIONAL]
         */
        this.receiveData = function(client) {
            this._client = (typeof client !== 'undefined') ? client : this._client;

            var json = client.json;
            var params = json.params;
            var action = json.action;

            defines.debug("Received data from broker ("+this._guid+")");
            defines.debug(JSON.stringify(json));

           	if (json.action == "registerBroker") {
				this.update(this._guid, this._name, this._key, json.host, json.port, this._permissions);

				//TODO: Async this call
				var serverGuid = database.valueForKey("settings", "guid", undefined);
				return this.sendData({labGUID: serverGuid});
            }
			else if (action == 'getEffectiveQueueLength')
            {
                //Two params for this action. We will ignore them for now.
                //var userGroup = params['userGroup'];
                //var priorityHint = params['priorityHint'];

                return this.sendData(queue.getEffectiveQueueLength());
            }
            else if (action == 'getLabConfiguration')
            {
                var configuration = experiment.getLabConfiguration();
                return this.sendData({labConfiguration: configuration});
            }
            else if (action == 'getLabStatus')
            {
                var lab_status = experiment.getStatus();
                return this.sendData({online:true, labStatusMessage: lab_status});
            }
            else if (action == 'cancel')
            {
                return this.sendError("The cancel action is not supported by this lab server");
            }
            else if (action == 'getExperimentStatus')
            {
				var experimentID     = params['experimentID'];
				var experimentStatus = experiment.experimentStatus(experimentID);
				return this.sendData({statusCode: experimentStatus});
		 	}
            else if (action == 'retrieveResult')
            {
				var experimentID     = params['experimentID'];
				var experimentStatus = experiment.experimentStatus(experimentID);

				var completed_experiments = database.getKeys("results");			
				if (completed_experiments.indexOf(''+experimentID) != -1)
				{
					//Experiment has been completed and the results are available.
					//defines.kFinished
					var results = database.valueForKey("results", experimentID, undefined);
					return this.sendData({statusCode: experimentStatus,
								   experimentResults: results});
				} 
				else
				{
					return this.sendData({statusCode: experimentStatus});
				}
            }
            else if (action == 'validate')
            {
                return this.sendError("The validate action is not supported by this lab server");
            }
            else if (action == 'submit')
            {
                var experimentID            = params['experimentID'];
                var experimentSpecification = params['experimentSpecification'];
                var specificationFormat		= params['specificationFormat'];
                var specificationID			= params['specificationID'];
                var userGroup               = params['userGroup'];
                var priorityHint            = params['priorityHint'];

				console.log(experimentSpecification);
				console.log(specificationID);
				console.log(params);
				//Permissions check
				if (!this._permissions.batched)
				{
					return this.sendError("You do not have permission to submit batched lab experiments");
				}
				else if (this._permissions.specifications.indexOf(specificationID) == -1)
				{
					return this.sendError("You do not have permission to use the '"+ specificationID +"' specification.");
				}
				else if (!this._permissions.js_engine && specificationFormat == "js")
				{
					return this.sendError("You do not have permission to use the Javascript Engine.");
				}
		
				//Experiment evaluation engine
				var submission = function (client, broker) {
	               	return function (options) {
						if (options.accepted) {
						    jsengine.submitScript(broker,
										  options.script,
							function (clientReturn)
							{
						        broker.sendData(clientReturn);
						        queue.pollQueue();
						    });
						}
					};
               	}(client, this);

                defines.verbose("Submitted experiment " + specificationFormat);
				if (specificationFormat == "xml" || specificationFormat == "json" || typeof specificationFormat == 'undefined')
				{
					specificationFormat = (specificationFormat == 'json') ? 'json' : 'xml';
					/*var useJSEngine = false; //NO reason to use the JS engine!
					if (useJSEngine) {
						defines.verbose("Creating specification with JSSpec");
						jsspec.javaScriptFromSpecification(specificationFormat, specificationID,
						experimentSpecification, submission);
					}
					else {*/
						jsspec.submitScript(this, specificationFormat,
								specificationID, experimentSpecification,
						function (client, broker) {
							return function (clientReturn) {
							broker.sendData(clientReturn);
							queue.pollQueue();
							};
						}(client, this));
                    //}
				}
				else if (specificationFormat == "js")
				{
					submission({accepted: true, script: experimentSpecification});
				}
				else
				{
					return this.sendError("The specification format '"+ specificationFormat +"' does not exist.");
				}
            }
            else if (action == 'schedule')
            {
				var reservationType = params['reservationType'];
                var startDate = params['startDate'];
				var endDate   = params['endDate'];
			}
            else
            {
                return this.sendError("The '" + action + "' action is not supported by this lab server");
            }
        };

		return this;
	} (guid, name, key, host, port, permissions);

	//Add to the broker dictionary
    broker_module.brokers[guid] = new_broker;
	
	//Return the new broker
	return new_broker;
};

/**
 * Returns the broker object with the specified guid
 * @param guid - the broker guid
 * @returns {} - broker object
 */
broker_module.findBroker = function (guid) {
    if (guid in broker_module.brokers) {
        return broker_module.brokers[guid];
    }
    defines.debug("Cannot find broker " + guid);
    return undefined;
};

/**
 * Deletes the broker object with the specified guid
 * @param guid - the broker guid
 * @returns {undefined} - successful
 */
broker_module.removeBroker = function (guid) {
    if (guid in broker_module.brokers) {
        delete broker_module.brokers[guid];
        database.removeValueForKey("brokers", guid, undefined);
        return true;
    }
    defines.debug("Unable to remove missing broker " + guid + ". Valid brokers are");
    for (guid in broker_module.brokers)
    {
        defines.debug(guid);
    }
    return false;
};

/**
 * Loads the brokers from the database.
 */
broker_module.initBrokers = function () {
    broker_module.brokers = {};
    var ids = database.getKeys("brokers");
    for (var i = 0; i < ids.length; i++)
    {
        var id = ids[i];
        var broker_data = database.valueForKey("brokers", id, undefined);
        broker_module.createBroker(
            id,
            broker_data['name'],
            broker_data['key'],
            broker_data['host'],
            broker_data['port'],
			broker_data['permissions']);
    }
};


/**
 * Send data to a client
 * @param data - javascript data dictionary
 * @param client - the client dictionary
 * @returns {boolean} - true if successful
 */
broker_module.sendDataToClient = function(data, client) {
    if (typeof client !== 'undefined' && client.type  == 'json') {
        //Convert the data into a json string
        var json_string = JSON.stringify(data);
        client.response.writeHead(200, {'Content-Type': 'application/json'});
        client.response.write(json_string);
        client.response.end();

        defines.debug("Sending data to unknown client");
        defines.debug(json_string);

        return true;
    } else {
        defines.verbose("Cannot send data to unknown client");
        return false;
    }
};

/**
 * Authenticates and passes client request through to the appropriate broker object.
 * @param client
 */
broker_module.handleRequest = function (client) {
    var json = client.json;

    var auth_scheme = json['auth'];
    if (auth_scheme == "token") //New authentication scheme
    {
        var broker_guid = json['guid'];
        var broker = broker_module.findBroker(broker_guid);

        if (typeof broker !== 'undefined') {
            if (broker.new_authentication(json)) broker.receiveData(client);
            else {
                broker.sendError("Invalid token", client);
            }
        }
        else
        {
            broker_module.sendDataToClient({'error':"Invalid broker guid: " + broker_guid}, client);
        }
    }
    else
    {
        broker_module.sendDataToClient({'error':"Unknown authentication scheme " + auth_scheme}, client);
    }

};

/**
 * Initialises the module with the express application
 * @param app - the express app.
 */
broker_module.setupExpress = function (app)
{
	app.get('/json', function(req, res)
	{
        defines.debug("Received json data");

		var client = {request:req,response:res,json:req.body,type:'json'};
		broker_module.handleRequest(client);
	});
	broker_module.initBrokers();
	defines.prettyLine("brokers", "loaded");
};