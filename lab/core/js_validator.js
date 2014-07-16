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
var express     = require('express');
var database    = require('./database');
var queue       = require('./queue');
var defines     = require('./defines');

var js_engine   = require('./js_engine');
var js_actions  = require('../js_actions');
var jsvalidator_module = module.exports;

/**
 *
 * @param app
 */
jsvalidator_module.sendReplyToClient = function(res, data_dictionary)
{
    var json_string = JSON.stringify(data_dictionary);

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(json_string);
    res.end();
}

jsvalidator_module._log = function(message)
{
    defines.verbose("JSValidator ("+defines.timeStamp()+")\t- "+message);
}

jsvalidator_module.runAction = function(action, options, validate, callback)
{
	
    if (validate) jsvalidator_module._log("validating action " + action + " with options " + JSON.stringify(options));
    else jsvalidator_module._log("running action " + action + " with options " + JSON.stringify(options));

    if (action in js_actions.actions) {

        //if ('action' in options)
        //    delete options['action'];
		defines.prettyLine("   js.validator", action + "("+JSON.stringify(options)+")");
        var action_code = js_actions.actions[action];
        action_code(options, validate, function(callback){ return function (error, options) {

            if (error.success == true) {
                callback({success: true, json: options, options:error});
            }
            else {
                jsvalidator_module._log("action validation failed (" + error.info + ")");
                callback({success: false, error: error.info});
            }

        };}(callback));
    }
    else
        callback({success: false, error: "unsupported action " + action});
}

jsvalidator_module.setupExpress = function(app)
{
    //Setup the validation page
	app.get('/javascript-validator', function(req,res)
    {
		var options = req.query;
        var action = options.action;
        var sandbox_id = options.sandbox_id;

		if (!defines.batchMode)
		{
			if (sandbox_id != defines.realTimeID)
			{
				jsvalidator_module._log("invalid real time ID " + sandbox_id);
			}
			else
			{
				jsvalidator_module.runAction(action, options, false, function(res, sandbox_id) {
					return function(json){
		                if (json.success == true)
						{
		                    jsvalidator_module.sendReplyToClient(res, {success: true, json: json.json});
		                }
		                else
		                {
		                   jsvalidator_module._log("fail");
		                }
            		};
				}(res, sandbox_id));
			}
		}
	});

    app.post('/javascript-validator', function(req,res)
    {
        var options = req.body;
        var action = options.action;
        var sandbox_id = options.sandbox_id;

		if (!defines.batchMode)
		{
			if (sandbox_id != defines.realTimeID)
			{
				jsvalidator_module._log("invalid real time ID " + sandbox_id);
			}
		}

        if (!defines.batchMode || js_engine.hasSandbox(sandbox_id))
        {
            var validate = js_engine.isValidating(sandbox_id);
			if (!defines.batchMode)
				validate = false;

			var short_id = sandbox_id.slice(0,4);
			defines.prettyLine("   js.validator", action+"."+ short_id);

            jsvalidator_module.runAction(action, options['arguments'], validate, function(res, sandbox_id, validate) { return function(json){

                if (json.success == true) {
                    if (validate) js_engine.increaseValidateExperimentTime(sandbox_id, json.options.time);
                    jsvalidator_module.sendReplyToClient(res, {success: true, json: json.json});
                }
                else
                {
					defines.prettyLine("   js.validator","error");		
					defines.prettyConsole(json.error+"\n\r");		
			
                    if (js_engine.strictExecution || validate) js_engine.killScript(sandbox_id, json.error);
                    else jsvalidator_module.sendReplyToClient(res, {success: false, error: json.error});
                }

            };}(res, sandbox_id, validate));
        }
        else
		{
            jsvalidator_module._log("invalid sandbox " + sandbox_id);
		}
    });

    jsvalidator_module._log("running");
	defines.prettyLine("js.validator", "loaded");
}
