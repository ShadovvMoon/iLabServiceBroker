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

var root_module = module.exports;

var database = require('./database');
var crypto 	 = require('crypto');
var ejs 	 = require('ejs');
var fs 		 = require('fs');

root_module.renderEJS = function(req,res,source_html, page_options)
{
	try
	{
		page_options = (typeof page_options !== 'undefined') ? page_options : {};
		var compiled = ejs.compile(source_html);
		var html = compiled({ admin_module:root_module, database_module: database, page_options: page_options});
	 	res.send(html);
	}
	catch(err)
  	{
	 	console.log(err.toString());
		res.redirect("/");
  	}
}

root_module.setupExpress = function (app)
{
	/*
	 * AUTHORISATION SETUP
	 * Setup the local passport scheme to authenticate admin users.
 	 */

	//Setup the authorization
	var passport      = require("passport");
	var LocalStrategy = require('passport-local').Strategy;

	//Passport
	passport.serializeUser(function(user, done)
	{
	  	done(null, user);
	});
	
	passport.deserializeUser(function(obj, done)
	{
	  	done(null, obj);
	});
	
	passport.use(new LocalStrategy
	(
	  	function(username, password, done){
			database.getUser(username, function(username, password, done){return function(err, selected_user){
				if (typeof selected_user !== 'undefined')
				{
					var salt = database.lab_salt();
					var shasum = crypto.createHash('sha1'); shasum.update(salt); shasum.update(password);
					var d = shasum.digest('hex');
					if (selected_user['hash'] == d)
						return done(null, {id:selected_user['id'] , username:username, hash:d});
					else
						return done(null, false, { message: 'Incorrect password.' });
				}
				else
					return done(null, false, { message: 'Incorrect username.' });
			}}(username, password, done));
	  	}
	));

	/*
	 * INITIAL SETUP
	 * Create a default admin username and password
 	 */
	if (database.userCount() == 0)
	{
		//Create a new login with a random password. Print this to the console.
		require('crypto').randomBytes(6, function(ex, buf)
		{
			var default_username = "admin";
			var default_password = buf.toString('hex');

			var salt = database.lab_salt();
			var shasum = crypto.createHash('sha1'); shasum.update(salt); shasum.update(default_password);
			var d = shasum.digest('hex');

			console.log("Creating new admin user");
			console.log("------------------");
			console.log("Username: " + default_username);
			console.log("Password: " + default_password);
			console.log("------------------");

			database.createUser(default_username, {role:'admin', id: 1, hash: d});
		});
	}

	/*
	 * LOGIN
	 * Create the interfaces used to login into the admin interface
 	 */

	//Show the login page
	app.get('/login', function(req, res)
	{
		if (req.user) return res.redirect('/dashboard');
		else
		{
			fs.readFile('html/login.html','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data);
			});
		}
	});

	//Handle the form posted from the login page
	app.post('/login', passport.authenticate('local'), function (req, res)
	{
		return res.redirect("/dashboard");
	});

	//Redirect the user to the appropriate subpage.
	app.get('/', function(req, res)
	{
		if (req.user) return res.redirect('/dashboard');
		else return res.redirect('/login');
	});

	//Logout of your current account
	app.get('/logoff', function (req, res)
	{
		req.logout();
		res.redirect("/login");
	});

	/*
	 * ADMIN UI
	 * Display the interface used to administer this lab server
 	 */

	//Show the admin dashboard page
	app.get('/dashboard', function(req,res)
	{
		if (req.user)
		{
			fs.readFile('html/dashboard.html','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data);
			});
		}
		else return res.redirect('/login');
	});

	//Save dashboard page
	app.post('/dashboard', function(req,res)
	{
		if (req.user)
		{
			var form_post = req.body;
			var new_name  = form_post['name'];
			var new_guid  = form_post['guid'];
			database.settings_database().set('name', new_name);
			database.settings_database().set('guid', new_guid);
			return database.flush(function(){res.redirect('/dashboard');});
		}
		else return res.redirect('/login');
	});

	//Show the brokers page
	app.get('/brokers', function(req,res)
	{
		if (req.user)
		{
			fs.readFile('html/brokers.html','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data);
			});
		}
		else return res.redirect('/login');
	});

	app.get('/edit_broker', function(req,res)
	{
		if (req.user)
		{
			fs.readFile('html/edit_broker.html','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data, req.query);
			});
		}
		else return res.redirect('/login');
	});

	app.get('/delete_broker', function(req,res)
	{
		if (req.user)
		{
			var broker_id = req.query.id;
			console.log("Deleting broker with GUID " + broker_id);
			database.broker_database().remove(broker_id);
			return database.flush(function(res)
			{
				return function(){res.redirect('/brokers');}
			}(res));
		}
		else return res.redirect('/login');
	});

	app.post('/edit_broker', function(req,res)
	{
		if (req.user)
		{
			var form_post = req.body;
			var new_name  = form_post['name'];
			var new_guid  = form_post['guid'];
			var new_key   = form_post['passkey'];
			var old_id    = form_post['old_identifier'];

			if (database.broker_database().list().indexOf(new_guid) != -1 && new_guid != old_id)
			{
				//Broker already exists.
				fs.readFile('html/edit_broker.html','utf-8',function (err, html_data)
				{
					root_module.renderEJS(req,res,html_data, req.query);
				});
			}
			else
			{
				if (old_id && old_id != '')
					database.broker_database().remove(old_id);

				database.broker_database().set(new_guid, {name:new_name, key:new_key});
				return database.flush(function(res)
				{
					return function(){res.redirect('/brokers');}
				}(res));
			}
		}
		else return res.redirect('/login');
	});
};