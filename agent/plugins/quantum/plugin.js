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

var fs  = require('fs');
var ejs = require('ejs');
(function () {
    var root = module.exports;
	function renderEJS(req,res,source_html, page_options)
	{
		try
		{
			page_options = (typeof page_options !== 'undefined') ? page_options : {};
			for (var attrname in req.query) { page_options[attrname] = req.query[attrname]; }

			var compiled = ejs.compile(source_html);
			var html = compiled({page_options: page_options});
		 	res.send(html);
		}
		catch(err)
	  	{
		 	console.log(err.toString());
			res.redirect("/");
	  	}
	}

	function submitSpecification(req,res, spec_type)
	{
		var core = root._coreModule;
		var post_params = req.body;
		if (core.isAuthenticated(req.body))
		{
			var token_uid = post_params['token_uid'];
			var xvalue = post_params['x_value'];

			var specification;
			if (spec_type == "xml")
				specification = "<experimentSpecification><xvalues>"+ xvalue +"</xvalues></experimentSpecification>";
			else if (spec_type == "json")
				specification = {experimentSpecification:{xvalues: [xvalue]}};	
			else if (spec_type == "js")
				specification = xvalue;	
			else
				specification = "Unknown specification type";

			var submit_data = {action:'submit',
								   id:"Modern iLab test",
			  experimentSpecification: specification,
				  specificationFormat:spec_type};

			//console.log(JSON.stringify(submit_data));
			core.sendActionToServer(submit_data, function(data, err) {
				if (err)
					console.log(err);
				//console.log(JSON.stringify(data));
				
				//Data returned from the server
				/*
				{ vReport: { accepted: true },
				  minTimeToLive: '0',
				  experimentId: 23,
				  wait: { effectiveQueueLength: '0', estWait: '0' } }
				*/

				if (data['vReport'].accepted == true)
				{
					//console.log("Specification accepted");
					res.redirect("/quantum?id=" + data.experimentId);
				}
				else
				{
					//console.log("Specification rejected");
					res.redirect("/quantum?fail=" + xvalue);
				}
			});
		}
		else
		{
			//console.log("Nothing sent to server");
		}
	}

	function setupPlugin(core, settings)
	{
		root._coreModule = core;
		var app = core.app;
		var plugin_port = app.get('port');

		app.get('/quantum', function (req, res)
		{
	 		//Read the blackboard plugin html
			fs.readFile('plugins/quantum/html/experiment.html','utf-8', function(req,res){ return function (err, html_data)
			{
				if (err)
					console.log(err);

				var user_id = "unknown";
				renderEJS(req,res,html_data,{token:core.tokenDictionary(user_id)});
			}}(req,res));
	 	});

		app.post('/quantum-submit-soap', function (req, res)
		{
			submitSpecification(req,res, "xml");
		});
		app.post('/quantum-submit-json', function (req, res)
		{
			submitSpecification(req,res, "json");
		});
		app.post('/quantum-submit-js', function (req, res)
		{
			submitSpecification(req,res, "js");
		});
	}
	root.setupPlugin = setupPlugin;
})();