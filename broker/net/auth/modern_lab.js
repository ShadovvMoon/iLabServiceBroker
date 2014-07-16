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
				var servers = database.getKeys('servers');

				var found_id = null;
				for (var i = 0; i < servers.length; i++)
				{	
					if (database.valueForKey("servers", servers[i])['guid'] == uid)
					{
						found_id = servers[i];
						break;
					}
				}	
				if (found_id)
				{
					var key = database.valueForKey("servers", found_id)['key'];
					if (key)
					{
						var dictionaryAttribute = JSON.stringify(req);
						var computedSignature = utils.hmacsha1(key, uid+dictionaryAttribute);
						if (computedSignature == token)
						{
							if (current_time-time_stamp < 10000 && current_time-time_stamp >= 0) //Needs to be less than ten seconds.
							{
								if (verbose_authentication) console.log("Authentication successful 1");
								return true; //All good
							}
							else
							{
								if (verbose_authentication) console.log("Authentication failed - timeout (" + (current_time-time_stamp)/1000 + ")");
							}
						}	
						else
						{
							if (verbose_authentication) console.log("Authentication failed - invalid signature");
						}
					}
					else
					{
						if (verbose_authentication) console.log("Authentication failed - missing key");
					}
				}
				else
				{
					if (verbose_authentication) console.log("Authentication failed - unknown id " +  uid);
				}
			}
			else
			{
				if (verbose_authentication) console.log("Authentication failed - missing uid or token");
			}
		}
		else
		{
			if (verbose_authentication) console.log("Authentication failed - missing request");
		}
		//if (verbose_authentication) console.log("Authentication failed ?");
		return false;
	}

	var access_denied_error = "Access denied. The service broker admin has disabled your access to this feature.";
	function createAuth(app, server)
	{
		//Listener for JSON
		app.post('/lab-json', function(req, res)
		{	
			var client = {request:req,
						 response:res,
							 json:req.body,
							 type:'json'};
			if (isAuthenticated(req.body,server))
			{
				server.receiveDataFromLabServer(client, req.body['uid']);
			}
			else
				server.sendReplyToClient(client, {error: access_denied_error});
		});
	}
	function userPermissions()
	{

	}
	root.createAuth 	 = createAuth;
	root.userPermissions = userPermissions;
})();