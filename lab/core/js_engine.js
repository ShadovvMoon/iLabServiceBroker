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

var crypto 	    = require('crypto');
var path 	    = require('path');
var express     = require('express');
var database    = require('./database');
var queue       = require('./queue');
var defines     = require('./defines');
var http        = require('http');
var fs	        = require('fs');
var core        = require('./core');

var SandCastle  = require('sandcastle').SandCastle;
var Pool        = require('sandcastle').Pool;

var js_actions  = require('../js_actions');
var js_engine_module = module.exports;

js_engine_module.setupExpress = function (app)
{
    js_engine_module.executionTime = defines.executionTime; //60 seconds
    js_engine_module.strictExecution = defines.strictExecution;

	if (defines.sandboxes > 1)
	{
	    js_engine_module.usePools = true;
	    js_engine_module.poolCount = defines.sandboxes;
	}
	else
	{
		js_engine_module.usePools = false;
	}

    js_engine_module.scriptOptions = {timeout: js_engine_module.executionTime,
										  api:path.join(__dirname, 'js_api.js'),
								useStrictMode: defines.strictEngine,
								memoryLimitMB: defines.memoryLimitMB};
    js_engine_module._sandboxes = {};

    if (js_engine_module.usePools)
        js_engine_module.pool_engine = new Pool({ numberOfInstances: js_engine_module.poolCount }, js_engine_module.scriptOptions);
    else
        js_engine_module.sandbox_engine = new SandCastle(js_engine_module.scriptOptions);

	defines.prettyLine("js.engine", "loaded");
};


var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var ARGUMENT_NAMES = /([^\s,]+)/g;
js_engine_module._getParamNames = function(func) {
    var fnStr = func.toString().replace(STRIP_COMMENTS, '')
    var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES)
    if(result === null)
        result = []
    return result
}


js_engine_module.isValidating = function(script)
{
    return (script in js_engine_module._sandboxes && js_engine_module._sandboxes[script].validate == true);
}
js_engine_module.hasSandbox = function(script)
{
    return (script in js_engine_module._sandboxes);
}
js_engine_module.killScript = function(script, message)
{
    if (script in js_engine_module._sandboxes)
    {
        var sandbox_dictionary = js_engine_module._sandboxes[script];
        if (typeof sandbox_dictionary === 'undefined')
            return;
        if (typeof sandbox_dictionary.finished == true) return;
        sandbox_dictionary.finished = true;
        sandbox_dictionary.errors = true;
		var short_id = script.slice(0,4);
		defines.prettyLine("   js.engine", "killed."+ short_id);
        message = (typeof message !== 'undefined') ? message : "";
        js_engine_module._log("force killed " + script + ": " + message);
        sandbox_dictionary.sandbox.emit("exit");
    }
    else
    {
        js_engine_module._log("kill failed");
    }
}
js_engine_module._log = function(message)
{
    defines.verbose("JSEngine \t- "+message);
}

js_engine_module._scriptHeader = function(sandbox_id)
{
    var script_header = "";
    var sendActionToValidator = function(act, args, callback)
    {
        //Defined in the shovel
        var URL = "http://localhost:" + lab_port + "/javascript-validator";
        var opts = {
			arguments:args,
			action:act,
			sandbox_id: sandbox_id
		};
        if (typeof callback === 'undefined') //Sync
        {
			/*
            var body = sendAction(URL, JSON.stringify(opts), undefined);
            var returned_value = JSON.parse(body);
            return returned_value['json'];
			*/
			/*
			receivedSync = false;
			bodySync = undefined;
			sendAction(URL, JSON.stringify(opts), function(responseText, statusText){
				receivedSync = true;
				bodySync = responseText;
			});
			while (!received)
			{
				//Blocked.
			}
            var returned_value = JSON.parse(bodySync);
            return returned_value['json'];
			*/
        }
        else //ASync
        {
            sendAction(URL, JSON.stringify(opts), function(callback){
                return function(responseText, statusText)
                {
                    //if (statusText)
                    //    debug(statusText);

                    var returned_value = JSON.parse(responseText);
                    callback(returned_value['json']);
                }
            }(callback));
        }
    }
    script_header += "var sendActionToValidator = " + sendActionToValidator.toString() + ";\n";

    var supported_actions = Object.keys(js_actions.actions);
    for (var i = 0; i < supported_actions.length; i++) {
        var function_name = supported_actions[i];

        var wrapperFunction = "var " +
            function_name + "= function(options, callback){" +
            "return sendActionToValidator('"+function_name+"', options, callback);};\n";

        script_header += wrapperFunction;
    }
    return script_header;
}

js_engine_module.submitScript = function(broker, script, callback)
{
    js_engine_module.validateScript(script, function(broker, callback) {
        return function(vReport)
        {
            if (vReport.accepted == true)
            {
                var experiment_data = {
                    type : "js_engine",
                    guid: broker.getGuid(),
                    vReport: vReport,
                    script : script
                };

                experiment_data['experimentID'] = queue.incrementExperimentId();
                queue.add(experiment_data);

                var returnedData = {
                    vReport:vReport,
                    minTimeToLive:"0",
                    experimentID:experiment_data['experimentID'],
                    wait:{effectiveQueueLength: String(queue.queueLength()),
                        estWait: String(queue.estimatedWait())}
                };

                return callback(returnedData);
            }
            else
                return callback({vReport: vReport});
        }
    }(broker, callback))
}

js_engine_module.increaseValidateExperimentTime = function(script, time)
{
    if (script in js_engine_module._sandboxes)
    {
        js_engine_module._sandboxes[script].executionTime += time;
        if (js_engine_module._sandboxes[script].executionTime > (js_engine_module.executionTime / 1000))
        {
            var sandbox = js_engine_module._sandboxes[script].sandbox;
            sandbox.emit("timeout");
        }
    }
}

jsEngineValidations = 0;
js_engine_module.pollVQueue = function() {
	if (jsEngineValidations < defines.parallelValidation)
	{
		if (queue.numberOfVElements()>0)
		{
			defines.prettyLine("vqueue", "available");
			var vobject = queue.nextVElement();

			jsEngineValidations++;
			js_engine_module.executeScript(vobject.script, true, vobject.complete);
		}
		else
		{
			defines.prettyLine("vqueue", "empty");
		}
	}
	else
	{
		defines.prettyLine("vqueue", "busy " + queue.numberOfVElements());
	}
}

js_engine_module.validateScript = function(script, callback)
{
	//Put the validation object in the new queue
	queue.addVElement({script: script, complete: function(callback){
		return function(vReport)
		{
			callback(vReport);

			jsEngineValidations--;
			js_engine_module.pollVQueue();
		};
	}(callback)});
	js_engine_module.pollVQueue();
}

js_engine_module.executeScript = function(script, validate, callback)
{
    validate = (typeof validate !== 'undefined') ? validate : false;

    js_engine_module._log("loading script");
    defines.verbose(script);

    var sandbox_id = defines.randomString(36, 16);
    while (sandbox_id in js_engine_module._sandboxes)
        sandbox_id = defines.randomString(36, 16);
	
	var short_id = sandbox_id.slice(0,4);
	if (validate)
		defines.prettyLine("validating", short_id);
	else
		defines.prettyLine("executing", short_id);

    //var script_timeout = (validate) ? js_engine_module.validationTime : js_engine_module.executionTime;
    script = "exports.main = function(){" + script + " };";
    script = js_engine_module._scriptHeader(sandbox_id) + script;

    js_engine_module._log("script registered");
    if (js_engine_module.usePools)
        script = js_engine_module.pool_engine.createScript(script);
    else
        script = js_engine_module.sandbox_engine.createScript(script);

 	js_engine_module._log("script created");
    js_engine_module._sandboxes[sandbox_id] = {sandbox: script,
        validate: validate,
        callback:callback,
        executionTime:0.0,
        finished: false,
        errors: false};

	var executionTimeout = setTimeout(function(sandbox_id){return function(){
		//Make sure the experiment has executed by this time.
		if (sandbox_id in js_engine_module._sandboxes)
		{
			defines.prettyLine("   js.engine", "exec timeout."+ short_id);
			js_engine_module.killScript(sandbox_id);
		}
		else
		{
			defines.verbose("script missing");
		}
	}}(sandbox_id), (validate ? defines.validationTime : defines.executionTime));

   
    js_engine_module._log("script registered");
    script.on('timeout', function(sandbox_id) { return function() {
		defines.verbose("timeout");

        var sandbox_dictionary = js_engine_module._sandboxes[sandbox_id];
        if (typeof sandbox_dictionary === 'undefined')
            return;
        if (typeof sandbox_dictionary.finished == true) return;
        sandbox_dictionary.finished = true;
        sandbox_dictionary.errors = true;

		defines.prettyLine("   js.engine", "engine timeout."+ short_id );
        js_engine_module._log(sandbox_id + " timed out");
        sandbox_dictionary.sandbox.emit("exit");

		if (typeof sandbox_dictionary.callback !== 'undefined')
       		sandbox_dictionary.callback({accepted: false, errorMessage: "sandbox timeout"});

    };}(sandbox_id));

    script.on('exit', function(sandcastle, sandbox_id) {
        return function(err, result) {
			defines.verbose("script exited");
			defines.prettyLine("sandbox", "exiting");
            
            if (!(sandbox_id in js_engine_module._sandboxes))
			{
				defines.prettyLine("sandbox", "missing");
				defines.verbose("missing sandbox");
                return;
			}

			var sandbox_dictionary = js_engine_module._sandboxes[sandbox_id];
            if (typeof sandbox_dictionary.finished == true)
			{
				defines.prettyLine("sandbox", "finished");
				defines.verbose("sandbox finished");
				return;
			}
            sandbox_dictionary.finished = true;

            if (err || sandbox_dictionary.errors)
            {
				defines.verbose("finished with errors");
                if (err) {
                    defines.verbose(err.message);
                    defines.verbose(err.stack);

					defines.prettyLine("   js.engine", "syntax."+ short_id);
                }

                if (js_engine_module.isValidating(sandbox_id))
                    js_engine_module._log("validation failed ." + sandbox_id);

                if (typeof sandbox_dictionary.callback !== 'undefined')
                    sandbox_dictionary.callback({accepted: false, errorMessage: "syntax error"})
            }
            else {
				defines.verbose("finished without errors");
                if (js_engine_module.isValidating(sandbox_id))
                    js_engine_module._log("validation successful");

                if (typeof sandbox_dictionary.callback !== 'undefined')
                {
                    var executionTime = sandbox_dictionary.executionTime;
                    js_engine_module._log("estimated execution time: " + executionTime);
                    sandbox_dictionary.callback({accepted: true, result:result, estRuntime:executionTime})
                }
            }

			defines.prettyLine("sandbox", "release");
            delete js_engine_module._sandboxes[sandbox_id];
        };
    }(script, sandbox_id)); //Wrap the sandcastle

    js_engine_module._log("executing script with " + core.port + " " + sandbox_id);
    script.run({lab_port: core.port, sandbox_id: sandbox_id});
}