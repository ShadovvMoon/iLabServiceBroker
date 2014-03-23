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

var crypto 	 = require('crypto');
var express  = require('express');
var database = require('./database');
var queue    = require('./queue');
var defines  = require('./defines');
var experiment_module = module.exports;
var parseString = require('xml2js').parseString;

var experiment_db = database.experiment_database();
var lab_status  = "1: Idle";
var status_code = defines.idle_status;

experiment_module.setupExpress = function(app)
{
}

experiment_module.getLabConfiguration = function(callback)
{
	return {navmenuPhoto:[{image:["http://localhost:2020/experiment/lab_photo.jpg"]}]};
}

experiment_module.getStatusCode = function()
{
	return status_code;
}

experiment_module.getStatus = function()
{
	return lab_status;
}

function escapeRegExp(str)
{
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}
function replaceAll(find, replace, str)
{
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
experiment_module.validateExperiment = function(experimentSpecification, callback)
{
	//Unescape the string
	try
	{
		experimentSpecification = replaceAll('&amp;', '&', 
								  replaceAll('&lt;', '<', 
   						 	 	  replaceAll('&gt;', '>',
								  replaceAll('&quot;', '"',
								  replaceAll('&apos;', "'", experimentSpecification)))));
	
		console.log("VALIDATING EXPERIMENT");
		console.log(JSON.stringify(experimentSpecification));
	
		var xml_data = 
		parseString(experimentSpecification, {trim: true}, function(callback) { return function (err, result)
		{
			if (err)
				return callback({accepted:false, errorMessage:"XML parsing failed."});
	
			var experimentSpec = result['experimentSpecification'];
			if (typeof experimentSpec !== 'undefined')
			{
				var xvalues = experimentSpec['xvalues'];
				if (typeof xvalues !== 'undefined')
				{
					var required_values = xvalues[0].split(",");
					var i;
					var validation_successful = true;
					for (i=0; i < required_values.length; i++)
					{
						var xvalue = required_values[i];
						if (!(isNumber(xvalue)))
						{
							validation_successful = false;
							break;
						}
					}
					
					if (validation_successful)
					{
						console.log("Validation successful");
						return callback({accepted:true});
					}
					else
						return callback({accepted:false, errorMessage:"invalid x value"});
				}
			}
			return callback({accepted:false, errorMessage:"Invalid experiment specification"});
		}}(callback));
	}
	catch (err)
	{
		console.log(err.toString());
		return callback({accepted:false, errorMessage:"An unknown error occured in the validation. Please contact the lab server owner."});
	}
}

experiment_module.submitExperiment = function(experimentSpecification, callback)
{
	experiment_module.validateExperiment(experimentSpecification, function(experimentSpecification, callback){
	return 	function(validateExperiment)
	{		
		var accepted = validateExperiment['accepted'];
		if (accepted == true)
		{
			console.log("Adding experiment to queue");
			var experiment_data = {vReport:validateExperiment, experimentSpecification:experimentSpecification};
			var experimentId = database.createExperiment(experiment_data, callback);
		}
		else
			callback({vReport:validateExperiment});
		}
	}(experimentSpecification, callback));
}
experiment_module.convertToXML = function(experimentSpecification, callback)
{
	if (experimentSpecification && experimentSpecification != '')
		callback(undefined);

	experimentSpecification = replaceAll('&amp;', '&', 
						  replaceAll('&lt;', '<', 
 						 	 	  replaceAll('&gt;', '>',
						  replaceAll('&quot;', '"',
						  replaceAll('&apos;', "'", experimentSpecification)))));
	try
	{
		var xml_data = 
		parseString(experimentSpecification, {trim: true}, function(callback) { return function (err, result)
		{
			if (err)
			{
				console.log(err);
				return callback(err);
			}

			var experimentSpec = result['experimentSpecification'];
			if (typeof experimentSpec !== 'undefined')
			{
				return callback(experimentSpec);
			}
			return callback(undefined);
		}}(callback));
	}
	catch (err)
	{
		console.log(err.toString());
		return callback(undefined);
	}
}



//Experiment running
var current_experiment_id = 0;
experiment_module.runExperiment = function(experimentSpecification)
{
	status_code = defines.starting_status;
	
	//Send the specification to the experiment machinery
	status_code = defines.running_status;
	//----------------------------------------------

	console.log("Specification");
	console.log(JSON.stringify(experimentSpecification));

	var results={}
	var y_array=[];

	var xvalues = experimentSpecification['xvalues'];
	var required_values = xvalues[0].split(",");
	for (var i=0; i < required_values.length; i++)
	{
		var xvalue = required_values[i];
		var yvalue = Math.sin(xvalue);
		y_array.push(yvalue);
	}
	console.log(JSON.stringify(y_array));

	//----------------------------------------------

	//Finish the experiment
 	setTimeout(function()
    {
       status_code = defines.finishing_status;
		experiment_module.finishExperiment({y: y_array});
    }, 60000); //Experiment is taking 60 seconds to run (simulated)

	
}

experiment_module.finishExperiment = function(resultsDictionary)
{
	//Remove the experiment from the queue
	database.shiftQueue(function(resultsDictionary){return function(){
		status_code = defines.idle_status;

		//Save the results to the database and then
		//Poll the queue (start the next experiment in the queue)
		database.addResult(current_experiment_id, resultsDictionary, queue.pollQueue);
	}}(resultsDictionary));
}

experiment_module.startExperiment = function(experiment_data)
{
	var specification = experiment_data['experimentSpecification'];
	var xmlSpec = experiment_module.convertToXML(specification, function(experiment_data){
	return function(experimentSpecification)
	{
		if (experimentSpecification)
		{
			current_experiment_id = experiment_data['experimentId'];
			experiment_module.runExperiment(experimentSpecification);
		}
		else
		{
			/*console.log("Experiment " + experiment_data['experimentId'] + " failed.");
			database.shiftQueue(function(resultsDictionary){return function(){
				queue.pollQueue();
			}}({error:"Experiment failed: invalid specification"}));*/
		}
	}}(experiment_data));
}