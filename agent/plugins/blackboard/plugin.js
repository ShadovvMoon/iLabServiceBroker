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

var http 	= require("http");
var request = require('request')
var crypto 	= require('crypto')
var express = require('express');
var path 	= require('path');
var fs 		= require('fs');
var utils 	= require('./oauth/lib/utils.js');
var passport= require("passport");

(function () {
    var root = module.exports;
	function setupPlugin(core, settings)
	{
		var app = core.app;
		var plugin_port = app.get('port');

		//Blackboard plugin
		ConsumerStrategy = require('./oauth').Strategy;
		
		//Passport
		passport.serializeUser(function(user, done)
		{
		  	done(null, user);
		});
		
		passport.deserializeUser(function(obj, done)
		{
		  	done(null, obj);
		});
		
		var appList = {};
		appList[settings.consumer_key] = 
		{
			secret: settings.shared_secret
		}
		
		function findApp(key, next)
		{
		    var consumer = appList[key];
		    if (consumer)
		        next(null, {secret: consumer.secret});
		   	else
		        next(true);
		}
		
		passport.use(new ConsumerStrategy
		(
		  function(consumerKey, done)
		  {
			findApp(consumerKey, function(err, consumer)
			{
			    if (err) {return done(err);}
			    if (!consumer) {return done(null, false);}
		        return done(null, consumer, consumer.secret);
		    });
		  },
		  function checkTimestampAndNonce(timestamp, nonce, app, req, done)
		  {
		    var timeDelta = Math.round((new Date()).getTime() / 1000) - timestamp;
		    if (timeDelta >= 10)
		        done(null, false);
		    else
		        done(null, true);
		  }
		));

		//Create the access token url
		fs.readFile('plugins/blackboard/html/index.html',function (err, html_data)
		{
			if (err)
				console.log(err);

			app.post('/access_token', passport.authenticate('oauth', {session: false}), function (req, res)
			{
		  		var body 		= req.body;
				var uid 		= body['user_id'];
				var fullname 	= body['lis_person_name_full'];
				var givenname 	= body['lis_person_name_given'];
				var user_id		= body['user_id'];
	
				//Send the access details to the client
				res.writeHead(200, { 'Content-Type': 'text/html'});
				res.write('<html><head>');		
				res.write(core.javascriptToken(user_id));	
				res.write(html_data);
				res.write('</body></html>');
				res.end();
		 	});
		});
	}
	root.setupPlugin = setupPlugin;
})();