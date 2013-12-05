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

var http = require("http");
var soap = require("./soap");
var ilab = require("./ilab");
var config = require('../config')

function start()
{
	//Connect to each server
	var i;
	for (i=0; i < config.servers.length; i++)
	{
		var server_data = config.servers[i];
		var lab_server = ilab.connectTo(server_data, function(){
			lab_server.printMethods();
	
			/*
			lab_server.getEffectiveQueueLength('default', 0, function(length, wait, err)
			{
				
			});
			*/
	
			lab_server.getLabConfiguration(function(xml, err) {
			});
	
		});

	}

	//HTTP client
	http.createServer(function(request, response)
	{
		//Set up the HTML page
	  	response.writeHead(200, {"Content-Type": "text/plain"});
		response.write("Hello World");

		//Close the connection
	  	response.end();
	}).listen(8080);


	//Display the start message
	console.log("iLab jsnode server running");
	console.log("----------------------");
	console.log("Version: 1.0");
	console.log("  Build: 1");
	console.log("   Date: 4/12/2013");
	console.log("----------------------");
}
exports.start = start;