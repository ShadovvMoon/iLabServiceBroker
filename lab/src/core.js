/*
 * Copyright (c) 2014, Samuel Colbran <contact@samuco.net>
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

var crypto     = require('crypto');
var express    = require('express');
var broker     = require('./broker');
var database   = require('./database');
var admin      = require('./admin');
var queue      = require('./queue');
var experiment = require('./experiment');

XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
module.exports.createLab = (function (app,callback)
{
	database.flush(function()
	{
		var lab_port = database.lab_port();
		require('crypto').randomBytes(48, function(ex, buf)
		{
			//Generate a random secret
			var secret = buf.toString('hex');
	
			//Creates the express app
			function setupExpress(secret)
			{
				var passport = require("passport");
				var     path = require('path');
		
				//Set the lab port
				app.set('port', lab_port);
		
				app.use(express.cookieParser());
				app.use(express.bodyParser());
			
				/*Create a unique cookie name based on the port.
			      This allows multiple labs on the same machine.*/
				var cookieName = 'labCookie' + lab_port;
		  		app.use(express.session({secret: secret, key: cookieName}));		  	

				//Initialise the passport middleware for the admin auth
				app.use(passport.initialize());
				app.use(passport.session());
			  	app.use(express.methodOverride());
				app.use(app.router);
				app.use(express.static(path.join(process.cwd() , '/public')));
				app.use(express.logger());

				//Setup the broker communication
				broker.setupExpress(app);

				//Setup the administrator page
				admin.setupExpress(app);

				//Setup the actual experiment
				experiment.setupExpress(app);

				//Start the experiment queue
				queue.startQueue(function()
				{
					//Create the html server
					require("http").createServer(app).listen(app.get('port'), function()
					{
						console.log("Running on port " + app.get('port'));
						console.log("");
					});
				});
			}
		
			//Setup the lab
			setupExpress(secret);
		});
	});
});

