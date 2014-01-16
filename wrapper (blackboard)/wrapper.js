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
var utils 	= require('./passport-http-2legged-oauth/lib/utils.js');

XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
module.exports.createWrapper = (function (app,host,port)
{
	var root = Object.create({});
	root.host = host;
	root.port = port;

	var protocol = "wrapper-json";
	function sendActionToServer(data_dictionary, callback)
	{
		//Add authentication to the data dictionary
		var computedSignature = utils.hmacsha1(config.wrapper_key, config.wrapper_uid);
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
	
	root.receiveDataFromClient = receiveDataFromClient;
	return root;
});