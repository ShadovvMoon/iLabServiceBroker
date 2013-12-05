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

(function () {
    var root     = module.exports;
	var soap   = require('./soap');
	var config = require('../config')
	var parseString = require('xml2js').parseString;

	/*console.log("LAB: Header Keys "	 + Object.keys(header));
			console.log("LAB: Info Keys"	 + Object.keys(data));
			console.log("LAB: Faultstring " + data['faultstring']);
			console.log("LAB: " + data['labStatusMessage']);
			*/
/*root.soap_connection.call
		({
	        'method' : 'GetLabStatus',
	        'params' : {
	            'test' : 1
	        }
	    });*/

	//Print out the accepted SOAP methods
	function printMethods()
	{
		console.log("LAB: " + root.soap_connection.getAllFunctions());
	}
	
	//Returns the queue length for the lab server. 
	//Arguments: userGroup, priority (from -20 to 20), function(length, wait, err)
	function getEffectiveQueueLength(userGroup, priorityHint, callback)
	{
		if (config.verbose) console.log("LAB: GetEffectiveQueueLength");
		root.soap_connection.once('GetEffectiveQueueLength', function(err, data, header)
		{
			callback(data['effectiveQueueLength'], data['estWait'], data['faultstring']);
	    });
	    root.soap_connection.call
		({
	        'method' : 'GetEffectiveQueueLength',
			'params' : {'userGroup': userGroup,
					 'priorityHint': priorityHint}
	    });
	}

	//Returns the lab configuration in xml format.
	//Arguments: function(xml, err)
	function getLabConfiguration(callback)
	{
		if (config.verbose) console.log("LAB: GetLabConfiguration");
		root.soap_connection.once('GetLabConfiguration', function(err, data, header)
		{
			parseString(data['GetLabConfigurationResult'], {trim: true}, function (err, result) {
				console.log("LAB: Result Keys "	 + Object.keys(result));
				console.log("LAB: Result Keys "	 + Object.keys(result['labConfiguration']));
				console.log("LAB: Result Keys "	 + result['labConfiguration']['navmenuPhoto']);


			    console.log(result);
			});
			callback(data['GetLabConfigurationResult'], data['faultstring']);
	    });
	    root.soap_connection.call
		({
	        'method' : 'GetLabConfiguration',
	    });
	}

	//Returns the lab status.
	//Arguments: function(message, keys, err)
	function getLabStatus(callback)
	{
		if (config.verbose) console.log("LAB: GetLabStatus");
		root.soap_connection.once('GetLabStatus', function(err, data, header)
		{
			callback(data['labStatusMessage'], data['Keysonline'], data['faultstring']);
	    });
	    root.soap_connection.call
		({
	        'method' : 'GetLabStatus',
	    });
	}
	
	function connectTo(params, callback)
	{
		//Connect to the iLab
		if (config.verbose) console.log("Connecting to iLab " + params.host);
	
		//Connect to the SOAP
		var soap_connection = soap.createConnection(
						params.host, //Host name
						params.port, //Port
						'/'+params.server+'/LabServerWebService',
						'/'+params.server+'/LabServerWebService?wsdl', //Wsdl file
						params.guid,
						params.passkey); 
	
		//Create the functions to handle replies
		if (config.verbose) console.log("SOAP: Connecting");
	
		soap_connection.once('initialized', function()
		{
			if (config.verbose) console.log("SOAP: Connected");
		   	callback();
		});
	
		soap_connection.init();
		root.soap_connection = soap_connection;

		return root
	}
	
	root.connectTo = connectTo;
	root.printMethods = printMethods;
	root.getLabStatus = getLabStatus;
	root.getEffectiveQueueLength = getEffectiveQueueLength;
	root.getLabConfiguration = getLabConfiguration;
})();