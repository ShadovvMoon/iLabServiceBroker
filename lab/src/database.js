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

var db_module = module.exports;

//Settings database
var database_store = require('ministore')('database');
var settings_database = database_store('settings');
var settings_dictionary = {};

var default_port = 2020;
db_module.flush = function(callback)
{
	//Load the port from the database
	settings_dictionary['port'] = settings_database.get('port');

	//Load the server name from the database
	settings_dictionary['name'] = settings_database.get('name');

	//Load the GUID from the database
	var lab_guid = settings_database.get('guid');
	if (!lab_guid)
	{
		var guid = require('crypto').randomBytes(16).toString('hex');
		settings_dictionary['guid'] = guid;
		settings_database.set('guid', guid);
	}
	else settings_dictionary['guid'] = lab_guid;
	
	//Load the server secret from the database
	var lab_secret = settings_database.get('guid');
	if (!lab_secret)
	{
		var salt = require('crypto').randomBytes(48).toString('hex');
		settings_dictionary['salt'] = salt;
		settings_database.set('salt', salt);
	}
	else settings_dictionary['salt'] = lab_secret;
	
	//Call the callback			
	callback();
}

db_module.settings_database = function()
{
	return settings_database;
};

db_module.lab_port = function()
{
	var lab_port = settings_dictionary['port'];
	return (typeof lab_port != 'undefined') ? lab_port : default_port;
};

db_module.lab_guid = function()
{
	return settings_dictionary['guid'];
};

db_module.lab_salt = function()
{
	return settings_dictionary['salt'];
};

db_module.lab_name = function()
{
	var lab_name = settings_dictionary['name'];
	if (lab_name)
		return lab_name;
	return 'Undefined';
};


db_module.test_module = function()
{
	return console.log("Database module is functioning normally");
};

//Broker database
var broker_database  = database_store('brokers');
db_module.getBrokers = function(callback)
{
	var brokers = [];
	var guids = broker_database.list();
	for (var i = 0; i < guids.length; i++)
	{
		var guid = guids[i];
		var broker_info = broker_database.get(guid);
		brokers.push(broker_info);
	}
	callback(brokers);
}

//User database
var user_database  = database_store('users');
db_module.getUsers = function(callback)
{
	var users = [];
	var ids = user_database.list();
	for (var i = 0; i < ids.length; i++)
	{
		var id = ids[i];
		var user_info = user_database.get(id);
		users.push(user_info);
	}
	callback(users);
}

db_module.userCount = function()
{
	return user_database.list().length;
}

db_module.createUser = function(user_id, user_data)
{
	user_database.set(user_id, user_data);
}

db_module.getUser = function(user_id, callback)
{
	user_database.get(user_id, callback);
}