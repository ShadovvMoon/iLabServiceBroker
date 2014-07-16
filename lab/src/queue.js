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

var queue_module = module.exports;
queue_module.pollQueue = function()
{
	var experiment_queue = database.getQueue();
	if (experiment_queue.length > 0)
	{
		var next_experiment = experiment_queue[0];
		var experimentId = next_experiment['experimentId'];
		
		//Is there an experimentment currently running?
		var experiment_status = experiment.getStatusCode();
		if (experiment_status == defines.idle_status)
		{
			console.log("QUEUE: Starting experiment " + experimentId);
			experiment.startExperiment(next_experiment);
		}
		else
		{		
			console.log("QUEUE: Busy");
		}
	}
	else
	{
		console.log("QUEUE: Empty");
	}
}

//Store all the queue data on the disk with a cache in memory.
var experiment_db = database.experiment_database();
queue_module.startQueue = function(callback)
{
	database.loadQueue(function(callback){return function(){

		//Start the first experiment
		queue_module.pollQueue();

		callback();
	}}(callback));
}

queue_module.WaitEstimate = function()
{
	return {effectiveQueueLength: String(queue_module.queueLength()), estWait: String(queue_module.estimatedWait())};
}

queue_module.queueLength = function()
{
	return database.getQueue().length;
}

queue_module.estimatedWait = function()
{
	return 0;
}
