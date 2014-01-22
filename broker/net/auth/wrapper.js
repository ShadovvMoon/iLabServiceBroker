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
var utils 	= require('../../passport-http-2legged-oauth/lib/utils.js');
var config = require('../../config');

(function () {
    var root = module.exports;
	function isAuthenticated(req, server)
	{
		if (req)
		{
			var current_time = new Date().getTime(); //in ms

			var uid        = req['uid'];
			var token      = req['token'];
			var time_stamp = req['time-stamp'];

			req['token'] = '';

			if (uid && token)
			{
				var wrapper_database = server.wrappers;
				var wraps = wrapper_database.list();

				var found_id = null;
				for (var i = 0; i < wraps.length; i++)
				{	
					if (wrapper_database.get(wraps[i])['guid'] == uid)
					{
						found_id = wraps[i];
						break;
					}
				}	
				if (found_id)
				{
					var key = wrapper_database.get(found_id)['key'];
					if (key)
					{
						var dictionaryAttribute = JSON.stringify(req);
						var computedSignature = utils.hmacsha1(key, uid+dictionaryAttribute);
						if (computedSignature == token)
						{
							if (current_time-time_stamp < 10000)
							{
								//Do we have permission for the action?
								var actions = wrapper_database.get(found_id)['function'];
								var servers = wrapper_database.get(found_id)['server'];
	
								var requested_action = req['action'];
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
													if (config.verbose) console.log("Authentication successful");
													return true; //All good
												}
												else
												{
													if (config.verbose) console.log("Authentication failed - server disabled " + requested_server );
												}
											}
											else
											{
												return false; //False unless otherwise specified
											}
										}
										else
										{
											return true; //Command doesnt use an id
										}
									}
								}
								else
								{
									return true; //True unless otherwise specified
								}
							}
							else
							{
								if (config.verbose) console.log("Authentication failed - timeout (" + (current_time-time_stamp)/1000 + ")");
							}
						}	
						else
						{
							if (config.verbose) console.log("Authentication failed - invalid signature");
						}
					}
				}
			}
		}
		return false;
	}

	function createAuth(app, server)
	{
		//Listener for JSONP
		app.get('/wrapper-jsonp', function(req, res)
		{
			if (isAuthenticated(req.query,server))
			{
				server.receiveDataFromClient({
					request:req,
					response:res,
					json:req.query,
					type:'jsonp'
				},req['uid']);
			}
		});
	
		//Listener for JSON
		app.post('/wrapper-json', function(req, res)
		{	
			if (isAuthenticated(req.body,server))
			{
				server.receiveDataFromClient({
					request:req,
					response:res,
					json: req.body,
					type:'json'
					},req['uid']);
			}
		});
	}
	function userPermissions()
	{

	}
	root.createAuth 	 = createAuth;
	root.userPermissions = userPermissions;
})();