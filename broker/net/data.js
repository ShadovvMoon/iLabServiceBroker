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

var root 				 = module.exports;
var experiment_store 	 = require('ministore')('database/experiments');
var experimentDictionary = {};

//Clear the experiment dictionary 
function flushExperiments()
{
	var experiments = Object.keys(experimentDictionary);
	var i;
	for (i=0; i < experiments.length; i++)
	{
		experimentDictionary[experiments[i]].save();
	}
	experimentDictionary={};
}

function getExperimentStore(id)
{
	//Check if ID is in the experiment dictionary
	if (id in experimentDictionary && experimentDictionary[id] === undefined) {
		return experimentDictionary[id];
	}
	else {
		//Request the store and add it to the experiment dictionary
		var store = experiment_store(id);
		experimentDictionary[id]=store;
		return store;
	}
}

function setExperimentValue(id,key,val,callback)
{
	var store = root.getExperimentStore(id);
	store.set(key,val,callback);
}

function getExperimentValue(id,key,callback)
{
	var store = root.getExperimentStore(id);
	store.get(key,callback);
}

function removeExperimentValue(id,key,callback)
{
	var store = root.getExperimentStore(id);
	store.remove(key,callback);
}

root.getExperimentStore = getExperimentStore;
root.set 	= setExperimentValue;
root.get 	= getExperimentValue;
root.remove = removeExperimentValue;
root.flush 	= flushExperiments;
return root;