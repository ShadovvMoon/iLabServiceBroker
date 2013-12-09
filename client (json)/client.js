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

XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var FormData = require('form-data');

(function ()
{
	//Initilisation functions
	//-------------------------------
    var root = module.exports;
	function createClient(host, port)
	{
		root.host = host;
		root.port = port;
		root.http_location = "http://"+root.host+":"+root.port;

		return root;
	}

	//Transfer protocol using JSON
	//-------------------------------
	/*
	data_dictionary
		action - server action
			getBrokerInfo
			getLabConfiguration
	callback
		function (response, err)
	*/
	function sendActionToServer(data_dictionary, callback)
	{
		var xhr = new XMLHttpRequest();
		
		xhr.open('post', root.http_location+"/", true);
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
	
	//Helper functions
	//-------------------------------

	//Callback function(obj, err)
	function getConfiguration(callback)
	{
		var data_dictionary = {action:"getLabConfiguration"};
		sendActionToServer(data_dictionary, callback);
	}

	//Callback function(vendor, err)
	function getVendor(callback)
	{
		var data_dictionary = {action:"getBrokerInfo"};
		sendActionToServer(data_dictionary, function(response, err){
			callback(response['vendor'], err);			
		});
	}

	root.createClient = createClient;
	root.getVendor = getVendor;
	root.getConfiguration = getConfiguration;
})();