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
fs = require('fs');
config = require("../config.js");
crypto = require('crypto');
database = require('./database');
server = require('./server');
ejs = require('ejs');
path = require('path');

var supportedFunctions = ["getBrokerInfo", "getLabList", "getLabStatus", "getLabConfiguration", "getExperimentStatus", "getEffectiveQueueLength", "retrieveResult", "cancel", "submit", "validate", "registerWrapper", "registerSimpleWrapper", "getAgentInfo"];
var root_module = module.exports;
root_module.supportedFunctions = supportedFunctions;
/**
 * Evaluates an embedded javascript page and sends the result to the client.
 * @param req - the client request
 * @param res - the client response
 * @param source_html - the raw ejs file contents
 * @param page_options - [OPTIONAL] additional options that are passed through to the embedded javascript.
 */
root_module.renderEJS = function (req, res, source_html, page_options) {
    //Catch any errors that occur while executing the embedded javascript.
    try {
        page_options = (typeof page_options !== 'undefined') ? page_options : {};
        var compiled = ejs.compile(source_html, { filename: path.join(process.cwd(), 'html/file.ejs')});
        var html = compiled({ admin_module: root, database_module: database, server_module: server, page_options: page_options});
        res.send(html);
    }
    catch (err) {
        console.log(err.toString());
        res.redirect("/");
    }
}

/**
 * Creates the admin module. Sets up required express get and post urls.
 * @param app - express app
 * @param server - server module
 * @param passport - passport module
 */
root_module.create = function (app, server, passport) {
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect("/login");
    });

    /**
     * Checks whether a request is authenticated. If not, automatically redirect to the login page and return false.
     * @param req - the client request
     * @param res - the client response
     * @returns {boolean} true if authenticated.
     */
    function user_authenticated(req, res) {
        if (req.user) return true;
        res.redirect('/login');
        return false;
    }

    /**
     * LOGIN
     * Create the interfaces used to login into the admin interface
     */
    app.get('/login', function (req, res) {
        if (req.user) return res.redirect('/dashboard');
        else {
            fs.readFile('html/login.html', 'utf-8', function (err, html_data) {
                return root_module.renderEJS(req, res, html_data);
            });
        }
    });

    //Handle the form posted from the login page
    app.post('/login', passport.authenticate('local'), function (req, res) {
        return res.redirect("/general");
    });

    //Redirect the user to the appropriate subpage.
    app.get('/', function (req, res) {
        if (user_authenticated(req, res))
            return res.redirect('/general');
    });

    //Logout of your current account
    app.get('/logoff', function (req, res) {
        req.logout();
        res.redirect("/login");
    });

    function setupEJSPage(app, path, file) {
        app.get('/' + path, function (req, res) {
            if (user_authenticated(req, res)) {
                fs.readFile('html/' + file, 'utf-8', function (err, html_data) {
                    return root_module.renderEJS(req, res, html_data, req.query);
                });
            }
        });
    }

    //Setup EJS values
    setupEJSPage(app, 'general', 'general.ejs');
    setupEJSPage(app, 'labs', 'labs.ejs');

    setupEJSPage(app, 'legacy', 'legacy.ejs');
    setupEJSPage(app, 'legacy_debug', 'legacy_debug.ejs');

    setupEJSPage(app, 'modern', 'modern.ejs');
    setupEJSPage(app, 'agents', 'agents.ejs');
    setupEJSPage(app, 'edit_agent', 'edit_agent.ejs');
    setupEJSPage(app, 'logs', 'logs.ejs');
    setupEJSPage(app, 'profile', 'profile.ejs');

    /**
     * SETTINGS UI
     * Display the interface used to modify global settings (like lab name etc)
     */

        //Save dashboard page
    app.post('/general', function (req, res) {
        if (user_authenticated(req, res)) {
            var form_post = req.body;
            var new_name = form_post['name'];
            var new_guid = form_post['guid'];

            database.setValueForKey("settings", "vendor-name", new_name, undefined);
            database.setValueForKey("settings", "vendor-guid", new_guid, undefined);

            server.flushServers();
            return res.redirect('/general');
        }
    });

    app.get('/flush_servers', function (req, res) {
        if (user_authenticated(req, res)) {
            server.flushServers();

            //Wait a few seconds before refreshing to allow time for the flush
            setTimeout(function (res) {
                return function () {
                    res.redirect('/labs');
                };
            }(res), allowed_flush_time);
        }
    });

	function updateAgentPermissions(old_identifier, new_identifier){
		var agents = database.getKeys("wrappers");
		var i;
		for (i=0; i < agents.length; i++)
		{
			var name = agents[i];
			var wrapper_data = database.valueForKey("wrappers", name, undefined);
            if (wrapper_data)
            {
				var server_dict = wrapper_data['server'];
		        if (server_dict)
				{
		        	if (old_identifier in server_dict)
					{
						server_dict[new_identifier] = server_dict[old_identifier];
						wrapper_data['server'] = server_dict;
						database.setValueForKey("wrappers", name, wrapper_data, undefined);
					}
				}
			}
		}
	}


    /**
     * LABS UI (LEGACY)
     */
    var allowed_flush_time = 2000;
    app.post('/legacy', function (req, res) {
        if (user_authenticated(req, res)) {
            var form_post = req.body;
            var old_identifier = form_post['old_identifier'];
            var identifier = form_post['identifier'];
            var host = form_post['host'];
            var service = form_post['service'];
            var passkey = form_post['passkey'];

            if (old_identifier != '')
			{
                database.removeValueForKey("servers", old_identifier, undefined);
				updateAgentPermissions(old_identifier, identifier);
			}

            database.setValueForKey("servers", identifier, {
                id: identifier,
                host: host,
                service: service,
                key: passkey,
                type: 'legacy'
            }, undefined);

            server.flushServers();

            //Wait a few seconds before refreshing to allow time for the flush
            setTimeout(function (res) {
                return function () {
                    res.redirect('/labs');
                };
            }(res), allowed_flush_time);
        }
    });

    app.post('/legacy_delete', function (req, res) {
        if (user_authenticated(req, res)) {
            var form_post = req.body;
            var identifier = form_post['identifier'];
            if (identifier != '') {
                database.removeValueForKey("servers", identifier, undefined);
            }

            server.flushServers();
            setTimeout(function (res) {
                return function () {
                    res.redirect('/labs');
                };
            }(res), allowed_flush_time);
        }
    });
    app.post('/agent_delete', function (req, res) {
        if (user_authenticated(req, res)) {
            var form_post = req.body;
            var identifier = form_post['identifier'];
            if (identifier != '') {
                database.removeValueForKey("wrappers", identifier, undefined);
            }
            res.redirect('/agents');
        }
    });

    /**
     * LABS UI (MODERN)
     */
    app.post('/modern', function (req, res) {
        if (user_authenticated(req, res)) {
            var form_post = req.body;
            var old_identifier = form_post['old_identifier'];
            var identifier = form_post['identifier'];
            var host = form_post['host'];
            var passkey = form_post['passkey'];

            if (old_identifier != '')
			{
                database.removeValueForKey("servers", old_identifier, undefined);
				updateAgentPermissions(old_identifier, identifier);
			}

            database.setValueForKey("servers", identifier, {
                id: identifier,
                host: host,
                key: passkey,
                type: 'modern'
            }, undefined);

            server.flushServers();

            //Wait a few seconds before refreshing to allow time for the flush
            setTimeout(function (res) {
                return function () {
                    res.redirect('/labs');
                };
            }(res), allowed_flush_time);
        }
    });

    /**
     * AGENTS
     */
    app.post('/edit_agent', function (req, res) {
        if (user_authenticated(req, res)) {
            //Update core values
            var old_id = req.body['old_identifier'];
            var name = req.body['name'];
            var guid = req.body['guid'];
            var key = req.body['key'];

            if (old_id != '')
                database.removeValueForKey("wrappers", old_id, undefined);

            var wrapper_data = database.valueForKey("wrappers", name, undefined);
            if (!wrapper_data)
                wrapper_data = {};

            wrapper_data['guid'] = guid;
            wrapper_data['key'] = key;

            //Function access
            var functions = supportedFunctions;
            var keys = Object.keys(req.body);
            var function_dict = wrapper_data['function'];
            if (!function_dict)
                function_dict = {}
            for (var i = 0; i < functions.length; i++) {
                var f = functions[i];
                if (keys.indexOf(f) != -1)
                    function_dict[f] = 1;
                else
                    function_dict[f] = 0;
            }
            wrapper_data['function'] = function_dict;

            //Server access
            var servs = database.getKeys("servers");
            var server_dict = wrapper_data['server'];
            if (!server_dict)
                server_dict = {}
            for (var i = 0; i < servs.length; i++) {
                var f = servs[i];
                if (keys.indexOf(f) != -1)
                    server_dict[f] = 1;
                else
                    server_dict[f] = 0;
            }
            wrapper_data['server'] = server_dict;

            //Write new data
            database.setValueForKey("wrappers", name, wrapper_data, undefined);
            return res.redirect("/agents");
        }
    });
}