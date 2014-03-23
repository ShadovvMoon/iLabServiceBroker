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
		var guid = require('crypto').randomBytes(32).toString('hex');
		settings_dictionary['guid'] = guid;
		settings_database.set('guid', guid);
	}
	else settings_dictionary['guid'] = lab_guid;
	
	//Load the server secret from the database
	var lab_secret = settings_database.get('salt');
	if (!lab_secret)
	{
		var salt = require('crypto').randomBytes(48).toString('hex');
		settings_dictionary['salt'] = salt;
		settings_database.set('salt', salt);
	}
	else settings_dictionary['salt'] = lab_secret;
	
	//Load the experiment queue		
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
db_module.broker_database = function()
{
	return broker_database;
};

db_module.getBrokers = function(callback)
{
	var brokers = [];
	var guids = broker_database.list();
	for (var i = 0; i < guids.length; i++)
	{
		var guid = guids[i];
		var broker_info = broker_database.get(guid);
		broker_info['guid'] = guid;
		brokers.push(broker_info);
	}
	if (typeof callback !== 'undefined')
		callback(brokers);
	return brokers;
}

db_module.getBroker = function(broker_id)
{
	return broker_database.get(broker_id);
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

//Experiment database
var experiment_database = database_store('experiment');
var experiment_queue    = [];
var next_experiment_id  = 0;

db_module.loadQueue = function(callback)
{
	next_experiment_id = settings_database.get('next_experiment_id');
	next_experiment_id = (typeof next_experiment_id !== 'undefined') ? next_experiment_id : 0;

	experiment_queue = experiment_database.get('experiment_queue');
	experiment_queue = (typeof experiment_queue !== 'undefined') ? experiment_queue : [];

	callback(experiment_queue);
	return experiment_queue;
}

db_module.addResult = function(experimentId, results, callback)
{	
	experiment_database.set(experimentId, {results: results}, callback);
}

db_module.saveQueue = function(callback)
{
	experiment_database.set('experiment_queue', experiment_queue, callback);
}

db_module.getQueue = function()
{	
	return experiment_queue;
}

db_module.shiftQueue = function(callback)
{	
	experiment_queue.shift(0);
	db_module.saveQueue(callback);
}

db_module.addToQueue = function(experiment_data, callback)
{	
	experiment_queue.push(experiment_data);
	db_module.saveQueue(callback);
}

db_module.createExperiment = function(experiment_data, callback)
{
	var vReport      = experiment_data['vReport'];
	var eSpec        = experiment_data['experimentSpecification'];
	var experimentId = next_experiment_id;

	//Add the experiment id to the dictionary
	experiment_data['experimentId'] = experimentId;

	//Increment the next id
	next_experiment_id++;
	settings_database.set('next_experiment_id', next_experiment_id);

	//Add the experiment to the queue
	var returnedData = {vReport:vReport, minTimeToLive:"0", experimentId:experimentId, wait:{effectiveQueueLength: String(experiment_queue.length), estWait: String(0)}};

	db_module.addToQueue(experiment_data,function(returnedData){return function(){callback(returnedData)}}(returnedData));
}

db_module.experiment_database = function()
{
	return experiment_database;
}