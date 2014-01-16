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

var oauth = require('oauth');
var sys = require('sys');
var config = require('../../config');

var consumer_key 		= "12345";
var shared_secret		= "secret";
//config.key = "POiuyhnbvGHjkhgvCfghjkuYGHbvd";

(function () {
    var root = module.exports;
	function createAuth(app, server)
	{
		//Listener for JSONP
		app.get('/lti-jsonp', function(req, res)
		{
			console.log("LTI (jsonp)");
			server.receiveDataFromClient({
				request:req,
				response:res,
				json:req.query,
				type:'jsonp'
			});
		});

		//Listener for JSON
		app.post('/lti-json', function(req, res)
		{	
			console.log("LTI (json)");
			server.receiveDataFromClient({
				request:req,
				response:res,
				json: req.body,
				type:'json'
				});
		});

		//Listener for Login
		app.post('/access_token', passport.authenticate('oauth', { session: false }), function (req, res){
   			var body 		= req.body;
			var uid 		= body['user_id'];
			var fullname 	= body['lis_person_name_full'];
			var givenname 	= body['lis_person_name_given'];

			console.log("LTI Login " + fullname);

			res.setHeader("content-type", "text/html");
		    res.send("Welcome " + givenname);
  		});
	}
	function userPermissions()
	{

	}
	root.createAuth 	 = createAuth;
	root.userPermissions = userPermissions;
})();