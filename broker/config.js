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


var config = {}
module.exports = config;
config.auth_plugins = [];
//-----------------------------
//hash information
config.salt = '';
config.serverSecret = '';

//Functions
config.supportedFunctions = ["getBrokerInfo", "getLabList", "getLabStatus", "getLabConfiguration", "getExperimentStatus", "getEffectiveQueueLength", "retrieveResult", "cancel", "submit", "validate"];

//Authentication plugins
/*
config.auth_plugins.push({
	name:			"noauth",
	file:			"noauth.js"
});*/
config.auth_plugins.push({
	name:			"admin",
	file:			"admin.js"
});
config.auth_plugins.push({
	name:			"wrapper",
	file:			"wrapper.js"
});

//verbose
//Output console debug messages
config.verbose 			= false;

//Spam console with all details
config.debug 			= false;

//Show express requests
config.show_requests 	= false;

//Load the servers in order (instead of all at once)
config.flush_ordered 	= false;

//Show time statistics
config.show_performance = false;