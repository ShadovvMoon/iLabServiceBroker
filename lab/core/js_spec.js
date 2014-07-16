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

var crypto = require('crypto');
var path = require('path');
var express = require('express');
var database = require('./database');
var queue = require('./queue');
var defines = require('./defines');
var fs = require('fs');
var parseString = require('xml2js').parseString;

var js_spec_module = module.exports;

/**
 *
 * @param str
 * @returns {XML|string|void|*}
 * @private
 */
function _escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

/**
 *
 * @param find
 * @param replace
 * @param str
 * @returns {XML|string|void|*}
 */
function replaceAll(find, replace, str) {
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
function _parseEscapedString(str) {
    return replaceAll('&amp;', '&', replaceAll('&lt;', '<', replaceAll('&gt;', '>', replaceAll('&quot;', '"', replaceAll('&apos;', "'", str)))));
}

/**
 *
 * @param str
 * @param callback
 * @private
 */
js_spec_module._xmlToJS = function (str, callback) {
    try {
        str = _parseEscapedString(str);
        defines.verbose(str);
        parseString(str, {trim: true}, callback);
    }
    catch (err) {
        callback(err.toString(), {});
    }
};

js_spec_module._log = function (message) {
    defines.verbose("JSSpec \t- " + message);
}


js_spec_module._plugins = {};
js_spec_module.setupExpress = function (app) {
    var files = fs.readdirSync('./js_specifications/');
    for (var i in files) {
        var extension = path.extname(files[i]);
        if (extension == ".js") {
            var plugin_name = files[i].slice(0, -3);
            var definition = require('../js_specifications/' + files[i]);
            js_spec_module._plugins[plugin_name] = definition;
            js_spec_module._log('specification ' + plugin_name + " loaded");
        }
    }
	defines.prettyLine("js.specification", "loaded");
}


//Spec stuff
js_spec_module._executeJSONSpecification = function (experiment, validate, experimentSpecification, callback) {
    if (experiment in js_spec_module._plugins) {
        var plugin = js_spec_module._plugins[experiment];
        try {
            plugin.executeJSONSpecification(experimentSpecification, validate, callback);
        }
        catch (err) {
            return callback({accepted: false, errorMessage: err.toString()});
        }
    }
    else
        return callback({accepted: false, errorMessage: experiment + " is an invalid plugin"});
}

js_spec_module.executeJSONSpecification = function (format, experiment, validate, experimentSpecification, callback) {
    defines.verbose("Creating JavaScript");
    switch (format) {
        case "xml":
            js_spec_module._xmlToJS(experimentSpecification, function (experiment, validate, callback) {
                return function (err, result) {
                    if (err) {
                        defines.verbose(experimentSpecification);
                        defines.verbose(err);
                        return callback({accepted: false, errorMessage: "XML parsing failed."});
                    }
                    js_spec_module._executeJSONSpecification(experiment, validate, result, callback);
                };
            }(experiment, validate, callback));

            break;
        case "json":
            js_spec_module._executeJSONSpecification(experiment, validate, experimentSpecification, callback);
            break;
        default:
            return callback({accepted: false, errorMessage: format + " is an invalid format"});
    }
}

js_spec_module.submitScript = function (broker, format, experiment, experimentSpecification, callback) {
    js_spec_module.executeJSONSpecification(format, experiment, true, experimentSpecification, function (callback) {
        return function (validate, result) {
            if (validate.success == true) {
                var vReport = {accepted: true, estRuntime: validate.time};
                var experiment_data = {
                    type: "js_spec",
                    guid: broker.getGuid(),
                    vReport: vReport,
                    format: format,
                    experiment: experiment,
                    experimentSpecification: experimentSpecification
                };

                experiment_data['experimentID'] = queue.incrementExperimentId();
                queue.add(experiment_data);

                var returnedData = {
                    vReport: vReport,
                    minTimeToLive: "0",
                    experimentID: experiment_data['experimentID'],
                    wait: {effectiveQueueLength: String(queue.queueLength()),
                        estWait: String(queue.estimatedWait())}
                };

                return callback(returnedData);
            }
            else {
                var vReport = {accepted: false, errorMessage: validate.errorMessage};
                return callback({vReport: vReport});
            }
        }
    }(callback))
}

//JS Engine stuff
js_spec_module._javaScriptFromJSONSpecification = function (experiment, experimentSpecification, callback) {
    if (experiment in js_spec_module._plugins) {
        var plugin = js_spec_module._plugins[experiment];
        try {
			defines.verbose(JSON.stringify(experimentSpecification));
            plugin.javaScriptFromJSONSpecification(experimentSpecification, callback);
        }
        catch (err) {
			defines.verbose(err.toString());
            return callback({accepted: false, errorMessage: err.toString()});
        }
    }
    else
	{
		defines.verbose("invalid plugin");
        return callback({accepted: false, errorMessage: experiment + " is an invalid plugin"});
	}
}

js_spec_module.javaScriptFromSpecification = function (format, experiment, experimentSpecification, callback) {
    defines.verbose("Creating JavaScript with format '"+ format +"'");
    switch (format) {
        case "xml":
            defines.verbose("VALIDATING XML EXPERIMENT");
            js_spec_module._xmlToJS(experimentSpecification, function (experiment, callback) {
                return function (err, result) {
                    if (err) {
                        defines.verbose(experimentSpecification);
                        defines.verbose(err);
                        return callback({accepted: false, errorMessage: "XML parsing failed."});
                    }
                    js_spec_module._javaScriptFromJSONSpecification(experiment, result, callback);
                };
            }(experiment, callback));

            break;
        case "json":
			defines.verbose("VALIDATING JSON EXPERIMENT");
            js_spec_module._javaScriptFromJSONSpecification(experiment, experimentSpecification, callback);
            break;
        default:
            return callback({accepted: false, errorMessage: format + " is an invalid format"});
    }
}