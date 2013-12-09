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
var express = require('express');
var path = require('path');
var app = express();

//Broker server url
var broker_host = 'localhost';
var broker_port = 8080;

var broker_client = require('./client');

//Start the express client
app.configure(function()
{
	//Set up the broker connection
	var client = broker_client.createClient(broker_host, broker_port);
	client.getVendor(function(vendor, err) {
		console.log(vendor);
	});

	//Create the interface and start the server
	app.set('port', 3000);
	app.set('views', __dirname + '/src/ui/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser({ 
		 keepExtensions: true, 
		 uploadDir: __dirname + '/tmp',
		 limit: '2mb'
	}));

	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'src/ui/public')));

	//Index url
	app.get('/', function(req, res)
	{
 		res.render('index');
	});
	
	//Methods used by the index
	app.post('/config', function(req, res)
	{
		
		client.getConfiguration(function(obj, err)
		{
			res.writeHead(200, {'Content-Type': 'application/json'});
	    	res.write(JSON.stringify(obj));
	    	res.end();
		});
	});

	//Create the http server
	http.createServer(app).listen(app.get('port'), function()
	{
		console.log("Express server listening on port " + app.get('port'));
	});
});