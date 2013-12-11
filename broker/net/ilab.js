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

(function()
{
    var root = module.exports;
	var soap   = require('./soap');
	var config = require('../config')
	var parseString = require('xml2js').parseString;

	//Print out the accepted SOAP methods
	function iLabServer(params, callback)
	{
		//Connect to the iLab
		if (config.verbose) console.log("Connecting to iLab " + params.host);
		if (config.debug) console.log(params.host + '/'+params.server+'/'+params.service);

		//Connect to the SOAP
		var soap_connection = soap.createConnection(
						params.host, //Host name
						params.port, //Port
						'/'+params.server+'/'+params.service,
						'/'+params.server+'/'+params.service+'?wsdl', //Wsdl file
						params.guid,
						params.passkey); 
	
		//Create the functions to handle replies
		console.log("SOAP: Connecting (" + params.host+")");
	
		soap_connection.once('initialized', function()
		{
			console.log("SOAP: Connected  (" + params.host+")");
		   	callback();
		});
	
		soap_connection.init();

		this.host = params.host;
		this.soap_connection = soap_connection;

		return this;
	}

	iLabServer.prototype.printMethods = function (){
		console.log("LAB: " + this.soap_connection.getAllFunctions());
	}
	
	//Returns the queue length for the lab server. 
	//Arguments: userGroup, priority (from -20 to 20), function(length, wait, err)
	iLabServer.prototype.getEffectiveQueueLength = function (userGroup, priorityHint, callback) {
		if (config.verbose) console.log("LAB: GetEffectiveQueueLength");
		this.soap_connection.once('GetEffectiveQueueLength', function(err, data, header)
		{
			callback(data, data['faultstring']);
	    });
	    this.soap_connection.call
		({
	        'method' : 'GetEffectiveQueueLength',
			'params' : {'userGroup': userGroup,
					 'priorityHint': priorityHint}
	    });
	}

	//Returns the lab configuration in xml format.
	//Arguments: function(xml, err)
	iLabServer.prototype.getLabConfiguration = function getLabConfiguration(callback) {
		if (config.verbose) console.log("LAB: GetLabConfiguration " + this.host);
		this.soap_connection.once('GetLabConfiguration', function(err, data, header)
		{
			console.log("Response");
			parseString(data['GetLabConfigurationResult'], {trim: true}, function (err, result)
			{
				callback(result, data['faultstring']);
			});
	    });
	    this.soap_connection.call
		({
	        'method' : 'GetLabConfiguration',
	    });
	}

	//Returns the lab status.
	//Arguments: function(message, keys, err)
	iLabServer.prototype.getLabStatus = function (callback) {
		if (config.verbose) console.log("LAB: GetLabStatus");
		this.soap_connection.once('GetLabStatus', function(err, data, header)
		{
			callback(data, data['faultstring']);
	    });
	    this.soap_connection.call
		({
	        'method' : 'GetLabStatus',
	    });
	}
	

	root.iLabServer = iLabServer;

	return root;
})();
