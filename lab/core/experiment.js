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

crypto 	    = require('crypto');
express     = require('express');
database    = require('./database');
queue       = require('./queue');
defines     = require('./defines');
parseString = require('xml2js').parseString;
js_engine   = require('./js_engine');
js_spec     = require('./js_spec');
broker      = require('./broker');
core        = require('./core');

var experiment_module = module.exports;
var status_code = defines.idle_status;

/**
 *
 * @param app
 */
experiment_module.setupExpress = function(app)
{
	defines.prettyLine("experiment", "loaded");
}

/**
 *
 * @returns {{navmenuPhoto: *[]}}
 */
experiment_module.getLabConfiguration = function()
{
	return {navmenuPhoto:[{image:["http://"+ core.host +":"+ core.port+"/experiment/lab_photo.jpg"]}]};
}

/**
 *
 * @returns {number}
 */
experiment_module.getStatusCode = function()
{
	return status_code;
}

/**
 *
 * @returns {string}
 */
experiment_module.getStatus = function()
{
    var status_code = experiment_module.getStatusCode();
    switch(status_code)
    {
        case 0:
            return "1: Idle";
        default:
            return "Unknown status code";
    }
}

/**
 *
 * @param str
 * @param callback
 * @private
 */
experiment_module._xmlToJS = function(str, callback)
{
    try
    {
        str = _parseEscapedString(str);
        parseString(str, {trim: true}, callback);
    }
    catch (err)
    {
        callback(err.toString(), {});
    }
};

/**
 *
 * @param str
 * @returns {XML|string|void|*}
 * @private
 */
function _escapeRegExp(str)
{
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

/**
 *
 * @param find
 * @param replace
 * @param str
 * @returns {XML|string|void|*}
 */
function replaceAll(find, replace, str)
{
  return str.replace(new RegExp(_escapeRegExp(find), 'g'), replace);
}

/**
 *
 * @param n
 * @returns {boolean}
 */
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 *
 * @param str
 * @returns {*}
 * @private
 */
function _parseEscapedString(str)
{
    return replaceAll('&amp;', '&', replaceAll('&lt;', '<', replaceAll('&gt;', '>', replaceAll('&quot;', '"', replaceAll('&apos;', "'", str)))));
}

/**
 *
 * @param experimentSpecification
 * @param callback
 * @returns {*}
 */
experiment_module.validateExperiment = function(experimentSpecification, callback)
{
	try
	{
        defines.verbose("VALIDATING EXPERIMENT");
        experiment_module._xmlToJS(experimentSpecification, function(callback) {
            return function (err, result)
            {
                if (err)
                    return callback({accepted:false, errorMessage:"XML parsing failed."});

                defines.verbose(JSON.stringify(result));
                var experimentSpec = result;
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
                            defines.verbose("Validation successful");
                            return callback({accepted:true});
                        }
                        else
                            return callback({accepted:false, errorMessage:"invalid x value"});
                    }
                }
                return callback({accepted:false, errorMessage:"Invalid experiment specification"});
            }
        } (callback));
	}
	catch (err)
	{
		defines.verbose(err.toString());
		return callback({accepted:false, errorMessage:"An unknown error was encountered in the validation. Please contact the lab server owner."});
	}
}

//Experiment running
var current_experiment_id = 0;
var current_experiment_guid = undefined;

experiment_module.runningExperiment = function()
{
	return ((status_code != defines.idle) ? current_experiment_id : -1);
};

experiment_module.experimentStatus = function(experimentID)
{
	var completed_experiments = database.getKeys("results");		
	if (completed_experiments.indexOf(''+experimentID) != -1)
	{
		return defines.kFinished;
	} 
	else
	{
		var running_experiment = experiment_module.runningExperiment();
		if (running_experiment == experimentID)
		{
			return defines.kRunning;
		}
		else
		{
			if (queue.containsExperiment(''+experimentID))
			{
				return defines.kInQueue;
			}
			else
			{
				return defines.kInvalidExperiment;
			}
		}
	}
};

/**
 *
 * @param experimentSpecification
 * @private
 */
experiment_module._runExperiment = function(experimentSpecification)
{
    //Turn on the equipment
	status_code = defines.starting_status;

	
	//Send the specification to the experiment machinery
	status_code = defines.running_status;

    try
    {
        current_experiment_guid = experimentSpecification['guid'];
        if (experimentSpecification['type'] == 'js_engine') {
            experimentSpecification = experimentSpecification['script'];
            js_engine.executeScript(experimentSpecification, false,
                function (vReport) {
                    if (vReport.accepted === true) {
                        defines.verbose("experiment successful");
                        status_code = defines.finishing_status;
                        experiment_module._finishExperiment(vReport.result);
                    }
                    else {
                        defines.verbose("experiment failed");
                        status_code = defines.finishing_status;
                        experiment_module._finishExperiment({});
                    }
                }
            );
        }
        else if (experimentSpecification['type'] == 'js_spec') {
            js_spec.executeJSONSpecification(experimentSpecification['format'], experimentSpecification['experiment'], false, experimentSpecification['experimentSpecification'],
                function (validate, result) {
                    if (validate.success === true) {
                        defines.verbose("experiment successful");
                        status_code = defines.finishing_status;
                        experiment_module._finishExperiment(result);
                    }
                    else {
                        defines.verbose("experiment failed");
                        status_code = defines.finishing_status;
                        experiment_module._finishExperiment({});
                    }
                }
            );
        }
        else
        {
            defines.verbose("invalid experiment type: " + experimentSpecification['type']);

            status_code = defines.finishing_status;
            experiment_module._finishExperiment({});
        }
    }
	catch (err)
    {
        defines.verbose("Experimental error occurred " + err.toString() );

        current_experiment_guid = "";
        status_code = defines.finishing_status;
        experiment_module._finishExperiment({});
    }
}

/**
 *
 * @param results
 * @private
 */
experiment_module._finishExperiment = function(results)
{
    defines.verbose("finishing experiment...");

	//Save the results to the database
    var current_experiment = experiment_module.runningExperiment();//queue.nextExperiment()-1;
    database.setValueForKey("results", current_experiment, results, undefined);

    //Turn off the equipment
    defines.verbose("experiment complete!");

    //Notify the broker that the results are now available
    var broker_object = broker.findBroker(current_experiment_guid);
    broker_object.sendData({action: "notify", experimentId: current_experiment}, function(response,status){
		defines.verbose(response + " " + status);
		defines.prettyLine("notifying broker", experimentId);
	});
	defines.prettyLine("continuing", "");
    //Remove the experiment from the queue
    queue.removeExperiment(current_experiment);
    status_code = defines.idle_status;

	//Poll the queue (start the next experiment in the queue)
    queue.pollQueue();
}

/**
 *
 * @param experiment_data
 */
experiment_module.startExperiment = function(experiment_data)
{
    current_experiment_id = experiment_data['experimentID'];
    experiment_module._runExperiment(experiment_data);

    /*
	var specification = experiment_data['experimentSpecification'];
    experiment_module._xmlToJS(specification, function(experiment_data){
        return function(err, experimentSpecification){
            if (experimentSpecification)
            {
                current_experiment_id = experiment_data['experimentId'];
                experiment_module._runExperiment(experimentSpecification);
            }
            else
            {
                defines.verbose("Experiment " + experiment_data['experimentId'] + " failed.");
                //database.shiftQueue(function(resultsDictionary){return function(){
                //	queue.pollQueue();
                //}}({error:"Experiment failed: invalid specification"}));
            }
        }
    }(experiment_data));
    */
}