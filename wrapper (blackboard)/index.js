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
var wrapper = require('./wrapper');
var config	= require("./config");
var utils 	= require('./passport-http-2legged-oauth/lib/utils.js');
var app 	= express();

passport 			= require("passport");
ConsumerStrategy   	= require('./passport-http-2legged-oauth').Strategy;

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
appList[config.consumer_key] = 
{
	secret: config.shared_secret
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

//Broker server url
var broker_host = 'localhost';
var broker_port = 8080;

//Read the HTML Page into memory
fs.readFile('html/index.html',function (err, html_data)
{
	crypto.randomBytes(48, function(ex, buf)
	{
		app.configure(function()
		{
			//Create the interface and start the server
			var secret = buf.toString('hex');
			app.set('port', 3000);
			app.use(express.favicon());
			
			if (config.show_requests)
			{
				app.use(express.logger("dev"));
			}

			app.use(express.cookieParser(secret));
		  	app.use(express.session());
		  	app.use(express.bodyParser());
			app.use(passport.initialize());
			app.use(passport.session());
		  	app.use(express.methodOverride()); // must come after bodyParser
			app.use(app.router);
			app.use('/public', express.static(path.join(__dirname, 'html/public')));
			app.use(express.logger());

			app.post('/access_token', passport.authenticate('oauth', {session: false}), function (req, res)
			{
		  		var body 		= req.body;
				var uid 		= body['user_id'];
				var fullname 	= body['lis_person_name_full'];
				var givenname 	= body['lis_person_name_given'];
				var user_id		= body['user_id'];
	
				//Send the access details to the client
				var computedSignature = utils.hmacsha1(secret, user_id);
				var JS_Script = '<script type="text/javascript">var token_string = {u:"'+user_id+'",t:"'+computedSignature+'"};</script>';
				res.writeHead(200, { 'Content-Type': 'text/html'});
				res.write('<html><head>');		
				res.write(JS_Script);	
				res.write(html_data);
				res.write('</body></html>');
				res.end();
		 	});

			if (config.allow_debug)
			{
				app.get('/', function (req, res)
				{
					var uid 		= "test";
	
					//Send the access details to the client
					var computedSignature = utils.hmacsha1(secret, uid);
					var JS_Script = '<script type="text/javascript">var token_string = {u:"'+ uid +'",t:"'+computedSignature+'"};</script>';
					res.writeHead(200, { 'Content-Type': 'text/html'});
					res.write('<html><head>');		
					res.write(JS_Script);	
					res.write(html_data);
					res.write('</body></html>');
					res.end();
			 	});
			}

			//Wrapper methods
			var broker = wrapper.createWrapper(app, config.broker_host, config.broker_port);
	
			//Authentication
			function isAuthenticated(req)
			{
				if (req)
				{
					var uid 	= req['uid'];
					var token 	= req['token'];
	
					if (uid && token)
					{
						var computedSignature = utils.hmacsha1(secret, uid);
						if (computedSignature == token)
							return true;
					}
				}
				return false;
			}	
	
			//Listeners
			app.get('/lti-jsonp', function(req, res)
			{
				if (isAuthenticated(req.query))
				{
					broker.receiveDataFromClient({
						request:req,
						response:res,
						json:req.query,
						type:'jsonp'
					});
				}
			});
		
			//Listener for JSON
			app.post('/lti-json', function(req, res)
			{	
				if (isAuthenticated(req.body))
				{
					broker.receiveDataFromClient({
						request:req,
						response:res,
						json: req.body,
						type:'json'
						});
				}
			});
		
			//Create the http server
			http.createServer(app).listen(app.get('port'), function()
			{
				console.log("iLab wrapper running on port " + app.get('port'));
			});
		});
	});
});