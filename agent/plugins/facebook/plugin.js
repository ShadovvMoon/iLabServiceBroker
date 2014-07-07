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
var passport= require("passport");
var FacebookStrategy = require('passport-facebook').Strategy;

var Store = require('ministore')('database');
var facebook_users 	 = Store('facebook_users');
(function () {
    var root = module.exports;
	function setupPlugin(core, database)
	{
		var app = core.app;
		var plugin_port = app.get('port');
		var callbackURL = "http://"+core.agent_host+":"+ core.agent_port+"/facebook";
	
		passport.serializeUser(function(user, done)
		{
		  	done(null, user);
		});
		
		passport.deserializeUser(function(obj, done)
		{
		  	done(null, obj);
		});

		passport.use(new FacebookStrategy ({
		    	clientID: database.get("clientID"),
		    	clientSecret: database.get("clientSecret"),
		    	callbackURL: callbackURL},

		  	function(accessToken, refreshToken, profile, done)
		  	{
			 	var user = facebook_users.get(profile.id);
				if (!user)
				{
					console.log("New Facebook User: " + profile.displayName + " ("+ profile.id+")");
					user = {id: profile.id, name: profile.displayName}

					facebook_users.set(profile.id, user);
					return done(false, false);
				}
			 	else
				{
					if (user['access'] == 'true')
					{
						console.log("Welcome back: " + profile.displayName + " ("+ profile.id+")");
						return done(null, user);
					}
					return done(false, false);
				}
		  	}
		));

 		//Read the blackboard plugin html
		fs.readFile('plugins/blackboard/html/index.html', function (err, html_data)
		{
			if (err)
				console.log(err);

			app.get('/facebook', passport.authenticate('facebook', {session: true}), function (req, res)
			{
				return res.redirect('/facebook-radioactivity');
		 	});

			app.get('/facebook-radioactivity', function (req,res)
			{
				if (req.user)
				{
					res.writeHead(200, { 'Content-Type': 'text/html'});
					res.write('<html><head>');		
					res.write(core.javascriptToken("test"));	
					res.write(html_data);
					res.write('</body></html>');
					res.end();
					return;
				}
				return res.redirect('/facebook');
			});
		});
	}
	root.setupPlugin = setupPlugin;
	root.setupGUI = function(terminal, database, callback) {
		console.log("Facebook authentication - version 1.0");
		terminal.question("clientID: ", function(key){
			terminal.question("clientSecret: ", function(secret){
				//Store the options in the database.
				database.set("clientID", key);
				database.set("clientSecret", secret);

				//Show a little info message
				console.log("You can change the embedded HTML interface by modifying");
				console.log("/plugins/blackboard/html/index.html");

				//Finish the setup
				callback();
			});
		});
	};
})();