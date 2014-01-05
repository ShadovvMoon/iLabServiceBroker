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

var root = module.exports;
function create(app, server, passport, storage)
{
	var access_users = storage['users'];
	var server_settings = storage['settings'];
	var servers = storage['servers'];

	//Index page
	//------------------------
		app.get('/', function(req, res, next)
		{
			if (req.user)
			{
				return res.render('admin/admin');
			}
			else
			{
				return res.render('login');
			}
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
		app.get('/user', function(req, res, next)
		{
			if (req.user)
			{
				return res.render('admin/user');
			}
			return res.redirect("/");
		});

	//Stats page
	//------------------------
		app.get('/stats', function(req, res, next)
		{
			if (req.user)
			{
				return res.render('admin/stats');
			}
			return res.redirect("/");
		});

	//Servers page
	//------------------------
		app.get('/servers', function(req, res, next)
		{
			if (req.user)
			{
				return res.render('admin/servers');
			}
			return res.redirect("/");
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

				return res.redirect("/servers");
			}
			return res.redirect("/");
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

				return res.redirect("/servers");
			}
			return res.redirect("/");
		});
	
}
exports.create = create;