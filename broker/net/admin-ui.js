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
var fs 	   = require('fs');
var config = require("../config.js");

var root = module.exports;
function create(app, server, passport, storage)
{
	var access_users = storage['users'];
	var server_settings = storage['settings'];
	var servers = storage['servers'];
	var wrappers = storage['wrappers'];

	function warningMessage(req)
	{
		if (req.user.hash == '22757090786eb727f84781d3e7ec71d1cd9b8f60')
			return warningJavascript(true, "Admin login", 'It appears you are using the default admin login. Please change your password <a href=\'/profile\'>here</a>');
		return "";
	}

	function warningJavascript(show_warning, warning_title, warning_message)
	{
		var js = "";
		if (show_warning)
		{
			js+='<script type="text/javascript">';
			js+='document.getElementById("page-message-box-h4").innerHTML = "' + warning_title + '";';
			js+='document.getElementById("page-message-box-p").innerHTML = "' + warning_message + '";';
			js+='document.getElementById("page-message-box").style.display = "block";';
			js+='</script>';
		}
		return js;
	}

	//Global commands
	app.get('/logout', function (req, res)
	{
		req.logout();
		res.redirect("/login");
	});

	function render_page(req,res,page_data,show_warning)
	{
		res.writeHead(200, { 'Content-Type': 'text/html'});
		res.write('<!DOCTYPE html><html><head lang="en">');		
		res.write(page_data);

		if (show_warning)
			res.write(warningMessage(req));

		res.write('</body></html>');
		res.end();
		return;
	}

	function render_admin_page_data(data,show_warning,req,res)
	{
		if (req.user)
			return render_page(req,res,data,show_warning);
		return res.redirect("/");
	}

	function render_admin_page(name,req,res)
	{
		if (req.user)
			return res.render(name);
		return res.redirect("/");
	}

	//Index page
	//------------------------
		app.get('/login', function(req, res, next)
		{
			render_admin_page('login', req, res);
		});

		fs.readFile('net/ui/views/admin/html/admin.html',function (err, page_admin_data)
		{
			app.get('/', function(req, res, next)
			{
				if (req.user)
				{
					render_page(req,res,page_admin_data, true);
					//return res.render('admin/admin');
				}
				else
					return res.render('login');
			});
		});

		app.post('/', passport.authenticate('local'), function (req, res)
		{
			res.redirect("/");
		});
	
		//Saving
		app.post('/save-index', function(req, res)
		{
			if (req.user)
			{
				server_settings.set('vendor-name', req.body['name']);
				server_settings.set('vendor-guid', req.body['guid']);
				return res.redirect("/");
			}
			return res.redirect("/");
		});

	//Users page
	//------------------------
	fs.readFile('net/ui/views/admin/html/admin-user.html',function (err, page_profile_data)
	{
		app.get('/user', function(req, res, next)
		{
			render_admin_page_data(page_profile_data, true, req, res);
		});
	});

	//My account page
	//------------------------
	fs.readFile('net/ui/views/admin/html/admin-profile.html',function (err, page_wrapper_data)
	{
		app.get('/profile', function(req, res, next)
		{
			render_admin_page_data(page_wrapper_data, false, req, res);
		});
	});


	//Wrappers page
	//------------------------
	fs.readFile('net/ui/views/admin/html/admin-wrappers.html',function (err, page_wrapper_data)
	{
		app.get('/wrappers', function(req, res, next)
		{
			render_admin_page_data(page_wrapper_data, true, req, res);
		});
	});

		app.post('/delete-wrapper', function(req, res)
		{
			if (req.user)
			{
				var old_id = req.body['hidden-identifier'];
				wrappers.remove(old_id);
			}

			render_admin_page('admin/wrappers', req, res);
		});	

		//Saving
		app.post('/save-wrapper', function(req, res)
		{
			if (req.user)
			{
				//Update core values
				var old_id = req.body['hidden-identifier'];
				var name = req.body['name'];
				var guid = req.body['guid'];
				var key = req.body['key'];

				if (old_id)
					wrappers.remove(old_id);

				var wrapper_data = wrappers.get(name);
				if (!wrapper_data)
					wrapper_data = {};

				wrapper_data['guid'] = guid;
				wrapper_data['key']  = key;

				//Function access
				var functions = config.supportedFunctions;
				var keys = Object.keys(req.body);
				var function_dict = wrapper_data['function'];
				if (!function_dict)
					function_dict={}
				for (var i = 0; i < functions.length; i++)
				{
					var f = functions[i];	
					if (keys.indexOf(f) != -1)
						function_dict[f] = 1;
					else
						function_dict[f] = 0;
				}
				wrapper_data['function']= function_dict;
			
				//Server access
				var servs = servers.list();
				var server_dict = wrapper_data['server'];
				if (! server_dict)
					server_dict ={}
				for (var i = 0; i < servs.length; i++)
				{
					var f = servs[i];	
					if (keys.indexOf(f) != -1)
						server_dict[f] = 1;
					else
						server_dict[f] = 0;
				}
				wrapper_data['server'] = server_dict;

				//Write new data
				wrappers.set(name, wrapper_data);
				return res.redirect("/wrappers");
			}
			return res.redirect("/");
		});

	//Stats page
	//------------------------
	fs.readFile('net/ui/views/admin/html/admin-stats.html',function (err, page_stats_data)
	{
		app.get('/stats', function(req, res, next)
		{
			render_admin_page_data(page_stats_data, true, req, res);
		});
	});


	//Debug page
	//------------------------
	fs.readFile('net/ui/views/admin/html/admin-debug.html',function (err, page_debug_data)
	{
		app.get('/debug', function(req, res, next)
		{
			render_admin_page_data(page_debug_data, true, req, res);
		});
	});
	
	//Servers page
	//------------------------
	fs.readFile('net/ui/views/admin/html/admin-servers.html',function (err, page_server_data)
	{
		app.get('/servers', function(req, res, next)
		{
			render_admin_page_data(page_server_data, true, req, res);
		});
	});

		app.get('/admin-ui', function(req, res)
		{
			if (req.user)
			{
				server.receiveAdminDataFromClient({
					request:req,
					response:res,
					json:req.query,
					type:'jsonp'
				});
			}
		});

		app.post('/delete-server', function(req, res)
		{
			if (req.user)
			{
				var old_id = req.body['hidden-identifier'];
				servers.remove(old_id);
			}

			render_admin_page('admin/servers', req, res);
		});

		//Saving
		app.post('/save-servers', function(req, res)
		{
			if (req.user)
			{
				var old_id = req.body['hidden-identifier'];
				var id = req.body['identifier'];
				var hst = req.body['host'];
				var service = req.body['service'];
				var passkey = req.body['passkey'];

				//Does a server with old-id exist?
				if (old_id == "")
				{
					//Create a new server
					servers.set(id, {
					id: id,
					host: hst,
					service: service,
					key: passkey});
				}
				else
				{
					var old_serv = servers.get(old_id);
					if (old_serv)
					{
						servers.remove(old_id);
						servers.set(id, {
						id: id,
						host: hst,
						service: service,
						key: passkey});
					}
					else
					{
						//Doesn't exist.
						console.log("Modified server doesnt exist " + old_id);
					}
				}	

				//Force a server update
				server.flushServers();
			}
			render_admin_page('admin/servers', req, res);
		});
	
}
exports.create = create;