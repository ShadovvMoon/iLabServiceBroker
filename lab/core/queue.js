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
var express    = require('express');
var database   = require('./database');
var experiment = require('./experiment');
var defines    = require('./defines');
var calendar    = require('./calendar');

var queue_module = module.exports;
queue_module._ram_queue = undefined;
queue_module._validation_queue = [];

queue_module.addVElement = function(vobject)
{
	queue_module._validation_queue.push(vobject);
}
queue_module.numberOfVElements = function()
{
	return queue_module._validation_queue.length;
}
queue_module.nextVElement = function()
{
	if (queue_module.numberOfVElements())
	{
		var vobject = queue_module._validation_queue[0];
		queue_module._validation_queue.shift(0);	
		return vobject;
	}
	return undefined;
}

/**
 * Return the current queue length
 * @returns {Number} - queue length
 */
queue_module.queueLength = function()
{
    return database.getKeys('experiment_queue').length;
};

/**
 * Return the estimated time until all experiments are completed
 * @returns {number} - estimated time
 */
queue_module.estimatedWait = function()
{
    return 0;
};

/**
 * Returns the effective length javascript dictionary
 * @returns {{effectiveQueueLength: string, estWait: string}}
 */
queue_module.getEffectiveQueueLength = function()
{
    return {effectiveQueueLength: String(queue_module.queueLength()), estWait: String(queue_module.estimatedWait())};
};

/**
 * Returns the next experiment id
 * @returns int - next id
 */
queue_module.nextExperiment = function()
{
    var next_experiment = database.valueForKey("settings", "next_experiment", undefined);
    next_experiment = (typeof next_experiment !== 'undefined') ? next_experiment : 0;
    return next_experiment;
};

/**
 * Increments the next experiment id
 * @returns int - next id
 */
queue_module.incrementExperimentId = function()
{
    var next_experiment = queue_module.nextExperiment();
    next_experiment++;
    database.setValueForKey("settings", "next_experiment", next_experiment, undefined);
    return next_experiment-1;
};

/**
 * Loads the ram queue from the database
 * @private
 */
queue_module._loadQueue = function()
{
    queue_module._ram_queue = database.valueForKey("queue", "cache", undefined);
    queue_module._ram_queue = (typeof queue_module._ram_queue !== 'undefined') ? queue_module._ram_queue : [];
};

/**
 * Saves the ram queue to the database
 * @private
 */
queue_module._saveQueue = function()
{
    queue_module._ram_queue = (typeof queue_module._ram_queue !== 'undefined') ? queue_module._ram_queue : [];
    database.setValueForKey("queue", "cache", queue_module._ram_queue, undefined);
};

/**
 * Adds an experiment to the queue
 * @param experiment
 */
queue_module.add = function(experiment)
{
    queue_module._ram_queue.push(experiment);
    queue_module._saveQueue();
};

/**
 * Removes the experiment at the top of the queue
 */
queue_module.removeExperiment = function(experimentID)
{
	var i;
    for (i=0; i < queue_module._ram_queue.length; i++)
    {
        var queued_experiment = queue_module._ram_queue[i];
        if (parseInt(queued_experiment['experimentID']) == parseInt(experimentID))
		{
			defines.prettyLine("experiment queue", "deleted " + experimentID);
			queue_module._ram_queue.splice(i,1);
			queue_module._saveQueue();
			return true;
		}
    }
	defines.prettyLine("experiment queue", "missing" + experimentID);
	return false;
};

/**
 * Removes the experiment at the top of the queue
 */
/*
queue_module.next = function()
{
    queue_module._ram_queue.shift(0);
    queue_module._saveQueue();
};
*/

queue_module.containsExperiment = function(experimentID)
{
    var i;
    for (i=0; i < queue_module._ram_queue.length; i++)
    {
        var queued_experiment = queue_module._ram_queue[i];
        if (queued_experiment['experimentID'] == experimentID)
		return true;
    }
	return false;
}

var refreshTimer = null;

/**
 * Checks the queue state. Starts the next experiment if possible.
 */
queue_module.pollQueue = function()
{
	if (refreshTimer)
	{
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
	if (queue_module._ram_queue.length > 0)
	{
        //Find an experiment with suitable access privileges
        defines.verbose("QUEUE: Finding next experiment...");
        var next_experiment = undefined;
        var i;
		var selected_index;
        for (i=0; i < queue_module._ram_queue.length; i++)
        {
            var queued_experiment = queue_module._ram_queue[i];
            var brokerName = broker.findBroker(queued_experiment['guid']).getName();
            var runtime = queued_experiment['vReport']['estRuntime'];
            if (calendar.hasAccess(brokerName, runtime))
            {
				queue_module._ram_queue[i].queueStatus = -1;

				if (next_experiment == undefined)
				{	
					selected_index = i;
                	next_experiment = queued_experiment;
				}
                //break;
            }
			else
			{
				queue_module._ram_queue[i].queueStatus = defines.kRestricted;
			}
        }
		queue_module._saveQueue();

        if (typeof next_experiment !== 'undefined')
        {
            var experimentId = next_experiment['experimentID'];

            //Is there an experimentment currently running?
            var experiment_status = experiment.getStatusCode();
            if (experiment_status == defines.idle_status)
            {
                defines.verbose("QUEUE: Starting experiment " + experimentId);
				defines.prettyLine("experiment queue", "starting " + experimentId);
				queue_module._ram_queue[selected_index].queueStatus = defines.kRunning;
				queue_module._saveQueue();
                experiment.startExperiment(next_experiment);
            }
            else
            {
				defines.prettyLine("experiment queue", "busy");
                defines.verbose("QUEUE: Busy");
            }
        }
        else
        {
			defines.prettyLine("experiment queue", queue_module._ram_queue.length + " restricted");
            defines.verbose("QUEUE: Restricted. There are " + queue_module._ram_queue.length + " experiments waiting to begin execution.");

			//Refresh the queue in a minute
			refreshTimer = setTimeout(queue_module.pollQueue, 60*1000);
        }
	}
	else
	{
		defines.prettyLine("experiment queue", "empty");
		defines.verbose("QUEUE: Empty");
	}
};

/**
 * Loads the queue and starts executing experiments
 * @param callback
 */
queue_module.startQueue = function(callback)
{
    queue_module._loadQueue();
	defines.prettyLine("queue", "loaded");
	defines.prettyConsole("\r\nStarting experiment queue\r\n");

    //Immediately poll the queue
    queue_module.pollQueue();
    callback();
};
