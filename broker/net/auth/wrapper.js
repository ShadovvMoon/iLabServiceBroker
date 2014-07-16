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

var sys = require('sys');
var utils 	= require('../../node_modules_modified/passport-http-2legged-oauth/lib/utils.js');
var config = require('../../config');
var database = require('../database');

const kAuthSuccessful = 0;
const kAuthFailedLabPermission = 1;
const kAuthFailedActionPermission = 2;
const kAuthFailedTimeout = 3;
const kAuthFailedInvalidSignature = 4;
const kAuthFailedMissingKey = 5;
const kAuthFailedInvalidId = 6;
const kAuthFailedMissingIdOrToken = 7;
const kAuthFailedMissingRequest = 8;
const kAuthFailedUnknown = 9;

function humanReadableStatus(error)
{
	if (error == kAuthSuccessful)
		return "Authentication was successful.";
	else if (error == kAuthFailedLabPermission)
		return "You do not have permission to access this lab.";
	else if (error == kAuthFailedActionPermission)
		return "You do not have permission to use this action.";
	else if (error == kAuthFailedTimeout)
		return "The request took too long to arrive.";
	else if (error == kAuthFailedInvalidSignature)
		return "The request signature is invalid.";
	else if (error == kAuthFailedMissingKey)
		return "The agent does not have a valid associated key.";
	else if (error == kAuthFailedInvalidId)
		return "The agent is not registered with this service broker.";
	else if (error == kAuthFailedMissingIdOrToken)
		return "An agent identifier was not provided.";
	else if (error == kAuthFailedMissingRequest)
		return "Missing request.";
	else if (error == kAuthFailedUnknown)
		return "An unknown error occured.";
	else
		return "This should not occur.";
}

(function () {
    var root = module.exports;
	function isAuthenticated(req, server)
	{
		var verbose_authentication = true;
		if (req)
		{
			var current_time = new Date().getTime(); //in ms

			var uid        = req['uid'];
			var token      = req['token'];
			var time_stamp = req['time-stamp'];

			req['token'] = '';

			if (uid && token)
			{
				var wraps = database.getKeys('wrappers');

				var found_id = null;
				for (var i = 0; i < wraps.length; i++)
				{	
					if (database.valueForKey("wrappers", wraps[i])['guid'] == uid)
					{
						found_id = wraps[i];
						break;
					}
				}	
				if (found_id)
				{
					var key = database.valueForKey("wrappers", found_id)['key'];
					if (key)
					{
						var dictionaryAttribute = JSON.stringify(req);
						var computedSignature = utils.hmacsha1(key, uid+dictionaryAttribute);
						if (computedSignature == token)
						{
							if (current_time-time_stamp < 10000 && current_time-time_stamp >= 0) //Needs to be less than ten seconds.
							{
								//Do we have permission for the action?
								var actions = database.valueForKey("wrappers", found_id)['function'];
								var servers = database.valueForKey("wrappers", found_id)['server'];
	
								var requested_action = req['action'];

								//Are we allowed to perform this action?
								if (actions[requested_action] != null)
								{
									if (actions[requested_action] == 1)
									{
										//Do we have permission for the lab?
										var requested_server = req['id'];
										if (requested_server != null)
										{
											if (servers[requested_server] != null)
											{
												if (servers[requested_server] == 1)
												{
													if (verbose_authentication) console.log("Authentication successful 1");
		
													return kAuthSuccessful; //All good
												}
												else
												{
													if (verbose_authentication) console.log("Authentication failed - server disabled " + requested_server );
													
													return kAuthFailedLabPermission;
												}
											}
											else
											{
												if (verbose_authentication) console.log("Authentication failed - no permission for lab");
												return kAuthFailedLabPermission; //False unless otherwise specified

											}
										}
										else
										{
											if (verbose_authentication) console.log("Authentication successful 2");
											return kAuthSuccessful; //Command doesnt use an id
										}
									}
									else
									{
										
										if (verbose_authentication) console.log("This action (" + requested_action + ") is not allowed");
										return kAuthFailedActionPermission; //True unless otherwise specified
									}
								}
								else
								{
									if (verbose_authentication) console.log("Authentication successful 2");
									return kAuthSuccessful; //True unless otherwise specified
								}
							}
							else
							{
								if (verbose_authentication) console.log("Authentication failed - timeout (" + (current_time-time_stamp)/1000 + ")");
								return kAuthFailedTimeout;
							}
						}	
						else
						{
							if (verbose_authentication) console.log("Authentication failed - invalid signature");
							return kAuthFailedInvalidSignature;
						}
					}
					else
					{
						if (verbose_authentication) console.log("Authentication failed - missing key");
						return kAuthFailedMissingKey;
					}
				}
				else
				{
					if (verbose_authentication) console.log("Authentication failed - unknown id " +  uid);
					return kAuthFailedInvalidId;
				}
			}
			else
			{
				if (verbose_authentication) console.log("Authentication failed - missing uid or token");
				return kAuthFailedMissingIdOrToken;
			}
		}
		else
		{
			if (verbose_authentication) console.log("Authentication failed - missing request");
			return kAuthFailedMissingRequest;
		}
		//if (verbose_authentication) console.log("Authentication failed ?");
		return kAuthFailedUnknown;
	}

	var access_denied_error = "Access denied. The service broker admin has disabled your access to this feature.";
	function createAuth(app, server)
	{
		//Listener for JSONP
		app.get('/wrapper-jsonp', function(req, res)
		{
			var client = {request:req,
						 response:res,
							 json:req.query,
							 type:'jsonp'};
			var authenticated = isAuthenticated(req.query,server);
			if (authenticated == kAuthSuccessful)
				return server.receiveDataFromClient(client,req.query['uid']);
			else
				return server.sendReplyToClient(client, {error: humanReadableStatus(authenticated), code: authenticated});
		});
	
		//Listener for JSON
		app.post('/wrapper-json', function(req, res)
		{	
			var client = {request:req,
						 response:res,
							 json:req.body,
							 type:'json'};
			var authenticated = isAuthenticated(req.body,server);
			if (authenticated == kAuthSuccessful)
				return server.receiveDataFromClient(client,req.body['uid']);
			else
				return server.sendReplyToClient(client, {error: humanReadableStatus(authenticated), code: authenticated});
		});

		//Listener for SETUP
		app.post('/wrapper-setup', function(req, res)
		{
			var client = {request:req,
						 response:res,
							 json:req.body,
							 type:'json'};
			var json = req.body;
			if (json['action'] == 'ping') {

				//Give the wrapper some information about our service broker.
				return server.sendReplyToClient(client, {
					success: true,
					vendor: database.valueForKey("settings", 'vendor-name', undefined)
				});
			}
			else {
				return server.sendReplyToClient(client, {error: "Invalid action", success: false});
			}
		});
	}
	function userPermissions()
	{

	}
	root.createAuth 	 = createAuth;
	root.userPermissions = userPermissions;
})();