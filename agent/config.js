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
config.plugins = [];
//-----------------------------

//Broker connection
config.broker_host   = 'localhost';
config.broker_port   = 8080;

//Agent info
config.wrapper_uid   = '';
config.wrapper_key   = '';
config.wrapper_host  = 'localhost';
config.wrapper_port  = 3000;

//Plugins
config.plugins.push({
	name: "blackboard",
	settings: {consumer_key: '', shared_secret: ''}
});
/*config.plugins.push({
	name:			"facebook",
	settings:		{clientID: '',
					clientSecret: '',
					 callbackURL: "http://"+config.wrapper_host+":"+config.wrapper_port+"/facebook"}
});*/
/*
config.plugins.push({
	name: "noauth",
	settings: {}
});
*/

//Other
config.simple_wrapper = false; //Disable talking back to the server. Useful for development on a local machine.
config.verbose 		  = false;
config.allow_debug	  = false; //Enable debug page
config.show_requests  = false; //Show Express requests