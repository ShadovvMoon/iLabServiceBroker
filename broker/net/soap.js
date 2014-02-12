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

var easy_soap    = require('../node_modules_modified/easysoap/index.js');
var config = require('../config')

module.exports = (function ()
{
    var root = Object.create({});
	function createConnection(host_url, host_port, soap_path, wsdl_path, guid, passkey)
	{
		//Setup the client parameters
		var clientParams = {
		
		    //Soap connection
		    host    : host_url,
		    path    : soap_path,
		    wsdl    : wsdl_path,
			port	: host_port,
	
		    //Soap header
		   	header  : [{
				'name'      : "AuthHeader",
		        'value'     : '<identifier>'+guid+'</identifier><passKey>'+ passkey +'</passKey>',
				'namespace' : "\"http://ilab.mit.edu\""
			}],
		};
	
		//Setup the client options
		var clientOptions = {
		    secure : true/false //is https or http
		};
	
		if (config.debug) console.log(host_url+ wsdl_path)
	
		//Create the new soap client
		var SoapClient = new easy_soap.Client(clientParams, clientOptions);
	
		SoapClient.on('error', function(error) {
		    console.log("SOAP: " + error + ' (' + clientParams.host + ')');
		});
		
		return SoapClient;
	}
	
	root.createConnection = createConnection;
	return root;
})();