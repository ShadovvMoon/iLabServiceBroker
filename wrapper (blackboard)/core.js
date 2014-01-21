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

var config	= require("./config");
var crypto 	= require('crypto');
var express = require('express');

XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
module.exports.createWrapper = (function (app,host,port,callback)
{
	require('crypto').randomBytes(48, function(ex, buf)
	{
		var secret      = buf.toString('hex');
		var root        = {host:host,
						   port:port,
						 secret:secret,
							app:app};
		var protocol = "wrapper-json";
		function sendActionToServer(data_dictionary, callback)
		{
			var computedSignature = hmacsha1(config.wrapper_key, config.wrapper_uid);
			data_dictionary['uid'] 	 = config.wrapper_uid;
			data_dictionary['token'] = computedSignature;
	
			var xhr = new XMLHttpRequest();
			xhr.open('post',"http://"+root.host+":"+root.port+"/"+protocol, true);
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
		}
		function hmacsha1(key, text)
		{
	   		return crypto.createHmac('sha1', key).update(text).digest('base64')
		}
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
		function receiveDataFromClient(client)
		{
			var responseFunction = (function(response_client)
			{
	         	return function(obj, err)
		 		{
			  	 	sendReplyToClient(response_client, obj);
	           	};
	      	})(client);
			sendActionToServer(client.json, responseFunction);
		}
		function isAuthenticated(req)
		{
			if (req)
			{
				var uid   = req['uid'];
				var token = req['token'];
	
				if (uid && token)
				{
					var computedSignature = hmacsha1(secret, uid);
					computedSignature = computedSignature.replace("+"," ");
					            token =             token.replace("+"," ");

					if (computedSignature == token)
						return true;
					else
					{
						console.log("Javascript authentication failed (" + uid + "). Incorrect signature: " + computedSignature + " should be " + token);
					}
				}
				else
				{
					console.log("Javascript authentication failed (" + uid + "). Missing UUID or Token.");
				}
			}
			return false;
		}	
		function javascriptToken(uid)
		{
			var computedSignature = hmacsha1(secret, uid);
			var JS_Script = '<script type="text/javascript">var token_string = {u:"'+uid+'",t:"'+computedSignature+'"};var agent_host = "' + config.wrapper_host + '";var agent_port = "' + config.wrapper_port + '";</script>';
			return JS_Script;
		}	
		root.javascriptToken = javascriptToken;
		function startMessage()
		{
			console.log("");
			console.log("iLab agent");
			console.log("Version: 1.0");
			console.log("  Build: 2");
			console.log("   Date: 21/1/2014");
			console.log("");
		}
		function setupExpress(secret)
		{
			var passport = require("passport");
			var     path = require('path');
	
			app.set('port', config.wrapper_port);
			if (config.show_requests)
			{
				app.use(express.logger("dev"));
			}
			app.use(express.cookieParser());
			app.use(express.bodyParser());
		
			var cookieName = 'agentCookies' + config.wrapper_port;
	  		app.use(express.session({secret: secret, key: cookieName}));		  	
			
			app.use(passport.initialize());
			app.use(passport.session());
		  	app.use(express.methodOverride());
			app.use(app.router);
			app.use('/public', express.static(path.join(__dirname, 'public')));
			app.use(express.logger());
		}
		function setupPlugins(secret)
		{
			var plugin_list = {};
			var k = 0;
			for (k=0; k < config.plugins.length; k++){
				var dict = config.plugins[k];
				var plug = require("./plugins/" + dict.name + "/plugin.js");
				plug.setupPlugin(root, dict.settings);
				plugin_list[dict.name] = plug;
				console.log("Loaded " + dict.name);}
			console.log("");
			return plugin_list;
		}
		startMessage();
		setupExpress(secret);
		setupPlugins(secret);
		app.get('/jsonp', function(req, res)
		{
			if (isAuthenticated(req.query))
			{
				receiveDataFromClient({
					request:req,
					response:res,
					json:req.query,
					type:'jsonp'
				});
			}
		});
		app.post('/json', function(req, res)
		{	
			if (isAuthenticated(req.body))
			{
				receiveDataFromClient({
					request:req,
					response:res,
					json: req.body,
					type:'json'
					});
			}
		});
		root.receiveDataFromClient = receiveDataFromClient;
		callback(root);
	});
});