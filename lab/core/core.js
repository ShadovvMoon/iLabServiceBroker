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

var crypto      = require('crypto');
var express     = require('express');
var broker      = require('./broker');
var database    = require('./database');
var admin       = require('./admin');
var queue       = require('./queue');
var experiment  = require('./experiment');
var jsengine    = require('./js_engine');
var jsvalidator = require('./js_validator');
var jsspec      = require('./js_spec');
       calendar = require('./calendar')
var portscanner = require('portscanner');
var readline = require('readline');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var core = module.exports;
core.port   = undefined;
core.host   = undefined;
core.secret = undefined;
core._default_port = 2020;

/**
 * Create a new lab server
 * @type {Function}
 */
core.createLab = (function (app,callback)
{
    core.loadSettings();
    crypto.randomBytes(48, function(ex, buf)
    {
        //Generate a random secret
        var secret = buf.toString('hex');

		function startMessage() {
            console.log("");
            console.log("Lab Server");
            console.log("Version: 1.0.2");
            console.log("  Build: 2");
            console.log("   Date: 16/7/2014");
            defines.printSeparator();
        }

        //Creates the express app
        function setupExpress(secret)
        {
            var passport = require("passport");
            var     path = require('path');

            //Set the lab port
            app.set('port', core.port);

            app.use(express.cookieParser());
            app.use(express.bodyParser());

            /**
             * Create a unique cookie name based on the port.
             * This allows multiple labs on the same machine.
             */
            var cookieName = 'labCookie' + core.port;
            app.use(express.session({secret: secret, key: cookieName}));

            //Initialise the passport middleware for the admin auth
            app.use(passport.initialize());
            app.use(passport.session());
            app.use(express.methodOverride());
            app.use(app.router);
            app.use(express.static(path.join(process.cwd() , '/public')));
            app.use(express.logger());

		 	function setupLabStart() {
	            defines.prettyConsole("available\nStarting server...\n");
	            startLab();
				database.setValueForKey("settings", "setup_complete", true, undefined)
	        }

			function setupLabPrompt() {
	            rl.question("Port for this lab: ", setupAgentPort);
	        }
	
	        function setupLabPort(lab_port) {
	            var continueFunction = function (port_number) {
	
	                //Store this port
					database.setValueForKey("settings", "port", port_number, undefined)
					core.port = port_number;
		            app.set('port', core.port);

	                //Check whether the port is valid
	                defines.prettyConsole("Checking port " + port_number + "...");
	                portscanner.checkPortStatus(port_number, '127.0.0.1', function (error, status) {
	                    // Status is 'open' if currently in use or 'closed' if available
	                    if (error)
	                        console.log(error);
	
	                    if (status == 'open') {
	                        defines.prettyConsole("unavailable.\n");
	                        return setupLabPrompt();
	                    }
	                    else {
	                        setupLabStart();
	                    }
	                });
	            };
	            if (lab_port == '') {
	                defines.prettyConsole("Finding port...");
	                return portscanner.findAPortNotInUse(2000, 20000, '127.0.0.1', function (error, port) {
	                    if (error) {
	                        defines.prettyConsole("failed.\n");
	                        return setupLabPrompt();
	                    }
	                    defines.prettyConsole("" + port + "\n");
	                    return continueFunction(parseInt(port));
	                })
	            }
	            else if (lab_port == 'skip') {
	                defines.prettyConsole("Skipping port check -> assuming port is ");
	                return setupAgentStart();
	            }
	            return continueFunction(parseInt(lab_port));
	        }
	        function setupLab() {
	            //Does the agent need to be setup?
	
	            var setup_complete = database.valueForKey("settings", "setup_complete", undefined);
	            if (setup_complete != true) {
	                rl.question("Press enter to begin Lab setup.", function (answer) {
	                    rl.question("Port (for this lab): ", setupLabPort);
	                });
	                return false;
	            }
	            return true;
	        }
			function startLab()
			{

			defines.prettyConsole("Loading modules\r\n");
            calendar.setupExpress(app);
            broker.setupExpress(app);
            admin.setupExpress(app);
            experiment.setupExpress(app);
            jsengine.setupExpress(app);
            jsvalidator.setupExpress(app);
            jsspec.setupExpress(app);
  			queue.startQueue(function()
            {

                //Create the html server
                require("http").createServer(app).listen(app.get('port'), function()
                {
                    defines.verbose("Running on port " + app.get('port'));
                    defines.verbose("");
					
					defines.prettyConsole("\r\nRunning on port " + app.get('port') + "\r\n");
					defines.printSeparator();
                });
       		});
			}
          
			if (setupLab()) {
				startLab();
			}
        }

        //Setup the lab
		defines.clearConsole();
		startMessage();
        setupExpress(secret);
    });
});

/**
 * Generates a new secret if core.secret is undefined.
 * @private
 */
core._checkSecret = function()
{
    if (typeof core.secret == 'undefined')
    {
        var salt = crypto.randomBytes(48).toString('hex');
        core.secret = salt;
        database.setValueForKey("settings", "secret", salt, undefined);
    }
};

/**
 * Load the settings from the database
 */

core.loadSettings = function()
{
    core.port   = database.valueForKey("settings", "port",   undefined);
    core.host   = database.valueForKey("settings", "host",   undefined);
    core.secret = database.valueForKey("settings", "secret", undefined);
	core.port   = (typeof core.port !== 'undefined') ? core.port : core.port = core._default_port;
    core._checkSecret();
};

/**
 * Save the settings to the database
 */
core.saveSettings = function()
{
    //Check that the variables are set
    core.port = (typeof core.port !== 'undefined') ? core.port : core._default_port;
    core._checkSecret();

    //Store the variables in the database
    database.setValueForKey("settings", "port", core.port, undefined);
    database.setValueForKey("settings", "secret", core.secret, undefined);
}