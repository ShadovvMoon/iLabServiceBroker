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

database = require('./database')
crypto 	 = require('crypto');
ejs 	 = require('ejs');
fs 		 = require('fs');
core     = require('./core');
brokers  = require('./broker');
path 	 = require('path');
calendar = require('./calendar')
js_actions  = require('../js_actions');

/**
 * Evaluates an embedded javascript page and sends the result to the client.
 * @param req - the client request
 * @param res - the client response
 * @param source_html - the raw ejs file contents
 * @param page_options - [OPTIONAL] additional options that are passed through to the embedded javascript.
 */
root_module.renderEJS = function(req,res,source_html, page_options)
{
    //Catch any errors that occur while executing the embedded javascript.
	try
	{
		page_options = (typeof page_options !== 'undefined') ? page_options : {};
		var compiled = ejs.compile(source_html, { filename: path.join(process.cwd(), 'html/file.ejs')});
		var html = compiled({ admin_module:root_module, database_module: database, page_options: page_options});
	 	res.send(html);
	}
	catch(err)
  	{
	 	console.log(err.toString());
		res.redirect("/");
  	}
}

/**
 * Initialises the module with the express application
 * @param app - the express app.
 */
root_module.setupExpress = function (app)
{
	/*
	 * AUTHORISATION SETUP
	 * Setup the local passport scheme to authenticate admin users.
 	 */

	//Setup the authorization
	var passport      = require("passport");
	var LocalStrategy = require('passport-local').Strategy;

	//Passport functions
	passport.serializeUser(function(user, done)
	{
	  	done(null, user);
	});
	
	passport.deserializeUser(function(obj, done)
	{
	  	done(null, obj);
	});

    //Admin authentication scheme
	passport.use(new LocalStrategy
	(
	  	function(username, password, done)
        {
            database.valueForKey("users", username, function(username, password, done){return function(err, selected_user)
            {
				if (typeof selected_user !== 'undefined')
				{
					var salt = core.secret;
					var shasum = crypto.createHash('sha1'); shasum.update(salt); shasum.update(password);
					var d = shasum.digest('hex');
					if (selected_user['hash'] == d)
						return done(null, {id:selected_user['id'] , username:username, hash:d});
					else
						return done(null, false, { message: 'Incorrect password.' });
				}
				else
                {
                    defines.debug("Undefined user");
					return done(null, false, { message: 'Incorrect username.' });
                }
			}}(username, password, done));
	  	}
	));

    /**
     * Checks whether a request is authenticated. If not, automatically redirect to the login page and return false.
     * @param req - the client request
     * @param res - the client response
     * @returns {boolean} true if authenticated.
     */
    function user_authenticated(req, res)
    {
        if (req.user) return true;
        res.redirect('/login');
        return false;
    }

	/**
	 * INITIAL SETUP
	 * Create a default admin username and password
 	 */
	if (database.getKeys("users").length == 0)
	{
		//Create a new login with a random password. Print this to the console.
		crypto.randomBytes(6, function(ex, buf)
		{
			var default_username = "admin";
			var default_password = buf.toString('hex');

			var salt = core.secret;
			var shasum = crypto.createHash('sha1'); shasum.update(salt); shasum.update(default_password);
			var d = shasum.digest('hex');

			defines.prettyConsole("Creating new admin user\n");
			defines.printSeparator();
			defines.prettyConsole("Username: " + default_username + "\n");
			defines.prettyConsole("Password: " + default_password + "\n");
			defines.printSeparator();

            database.setValueForKey("users", default_username, {role:'admin', id: 1, hash: d}, undefined);
		});
	}

	/**
	 * LOGIN
	 * Create the interfaces used to login into the admin interface
 	 */
	app.get('/login', function(req, res)
	{
		if (req.user) return res.redirect('/dashboard');
		else
		{
			fs.readFile('html/login.ejs','utf-8',function (err, html_data)
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
		if (user_authenticated(req,res))
            return res.redirect('/dashboard');
	});

	//Logout of your current account
	app.get('/logoff', function (req, res)
	{
		req.logout();
		res.redirect("/login");
	});

	/**
	 * SETTINGS UI
	 * Display the interface used to modify global settings (like lab name etc)
 	 */

	//Show the admin dashboard page
	app.get('/dashboard', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			fs.readFile('html/dashboard.ejs','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data);
			});
		}
	});

	//Save dashboard page
	app.post('/dashboard', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			var form_post = req.body;
			var new_name  = form_post['name'];
			var new_guid  = form_post['guid'];

            database.setValueForKey("settings", "name", new_name, undefined);
            database.setValueForKey("settings", "guid", new_guid, undefined);

            return res.redirect('/dashboard');
		}
	});

 	/**
     * Profile UI
     * Display the interface used to modify the user profile
     */

	app.get('/profile', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			fs.readFile('html/profile.ejs','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data, req.query);
			});
		}
	});

	app.post('/profile', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			var form_post = req.body;
			var oldpass = form_post['old'];
			var newpass = form_post['new'];
			var verifyp = form_post['verify'];

			var salt = core.secret;
			var shasum = crypto.createHash('sha1'); shasum.update(salt); shasum.update(oldpass);
			var d = shasum.digest('hex');
			if (req.user.hash == d)
			{
				if (newpass == verifyp)
				{
	                //Update the password file
	                shasum = crypto.createHash('sha1');
	                shasum.update(salt);
	                shasum.update(newpass);
	                d = shasum.digest('hex');
	
	                var user_settings = database.valueForKey("users", req.user.username, undefined);
	                user_settings['hash'] = d;
	                database.setValueForKey("users", req.user.username, user_settings, undefined);
	
	                req.user.hash = d;
	                return res.redirect('/profile?success=1');
				}
				else
				{
					return res.redirect('/profile?success=0&e=Verify%20password%20does%20not%20match');
				}
			}
			else
			{
				return res.redirect('/profile?success=0&e=Old%20password%20does%20not%20match');
			}
		}
	});



 	/**
     * SCHEDULE UI
     * Display the interface used to modify the schedule
     */

    //Show the schedule page
	app.get('/schedule', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			fs.readFile('html/schedule.ejs','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data);
			});
		}
	});

	//Save schedule page
	app.post('/schedule', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			var form_post = req.body;
			var calendarEvents  = form_post['events'];
			var jsonEvents = JSON.parse(calendarEvents);

            calendar.updateCalendar(jsonEvents);
            return res.redirect('/schedule');
		}
	});

	/**
     * QUEUE UI
     * Display the interface used to modify brokers (add/remove etc)
     */

    //Show the queue page
	app.get('/queue', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			fs.readFile('html/queue.ejs','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data);
			});
		}
	});

    //Show the queue page
	app.get('/queue_delete', function(req,res)
	{
        if (user_authenticated(req,res))
		{	
			var experimentID = req.query.id;
			queue.removeExperiment(experimentID);
			res.redirect('/queue');
		}
	});


    /**
     * BROKER UI
     * Display the interface used to modify brokers (add/remove etc)
     */

    //Show the brokers page
	app.get('/brokers', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			fs.readFile('html/brokers.ejs','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data);
			});
		}
	});

    //Editing broker page
	app.get('/edit_broker', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			fs.readFile('html/edit_broker.ejs','utf-8',function (err, html_data)
			{
				return root_module.renderEJS(req,res,html_data, req.query);
			});
		}
	});

    //Deleting broker
	app.get('/delete_broker', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			var broker_id = req.query.id;
			defines.verbose("Deleting broker with GUID " + broker_id);
            brokers.removeBroker(broker_id);
			res.redirect('/brokers');
		}
	});

    //Save editing broker
	app.post('/edit_broker', function(req,res)
	{
        if (user_authenticated(req,res))
		{
			var form_post = req.body;
			var new_name  = form_post['name'];
			var new_guid  = form_post['guid'];
			var new_key   = form_post['passkey'];
			var old_id    = form_post['old_identifier'];

			//Lots of new fields for permissions
			var interactive_permissions = Object.keys(form_post);
			var permissions = {};
			permissions.batched = ('batched' in form_post);
			permissions.batched_execution = ('batched_execution' in form_post)? form_post['batched_execution']:0;
			permissions.interactive = ('interactive' in form_post);
			permissions.interactive_max_session = ('interactive_execution' in form_post)? form_post['interactive_execution']:0;
			permissions.schedule_batched = ('schedule_batched' in form_post);
			permissions.schedule_interactive = ('schedule_interactive' in form_post);
			permissions.js_engine = ('jsengine' in form_post);
			permissions.specifications = [];
			permissions.apis = [];

			var i;
			for (i=0; i < interactive_permissions.length; i++)
			{
				var permission_key = interactive_permissions[i];
				if (permission_key.indexOf("specification_") == 0)
				{
					var specifcation_name = permission_key.slice("specification_".length);
					permissions.specifications.push(specifcation_name);
				}
				else if (permission_key.indexOf("interactive_api_") == 0)
				{
					var api_name = permission_key.slice("interactive_api_".length);
					permissions.apis.push(api_name);
				}
			}

			if (database.getKeys("brokers").indexOf(new_guid) != -1 && new_guid != old_id)
			{
				//Broker already exists.
				fs.readFile('html/edit_broker.ejs','utf-8',function (err, html_data)
				{
					root_module.renderEJS(req,res,html_data, req.query);
				});
			}
			else
			{
                var broker = brokers.findBroker(old_id);
				if (typeof broker !== 'undefined')
                {
                    broker.update(new_guid, new_name, new_key, broker.hostName(), broker.hostPort(), permissions);
                }
                else
                {
                    database.setValueForKey("brokers", new_guid, {
                        name: new_name,
                        key: new_key,
					permissions: permissions
                    });
                    brokers.initBrokers();
                }
				return res.redirect('/brokers');
			}
		}
	});
	defines.prettyLine("admin.gui", "loaded");
};