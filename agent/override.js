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

//This file provides an easy way to modify the behavior of commands.
function experimentCompleted(core, labID, experimentID)
{
	//Request the experiment results from the service broker
	core.sendActionToServer({id: labID, 
						 action:'retrieveResult',
				   experimentID: experimentID }, 
	function(obj, err) {	
		if (err){
			console.log(err);
		} else {
			console.log("experiment results");
			console.log(JSON.stringify(obj));
		}
	});
}

function receiveDataFromClient(core, client)
{
	//Reject any experiments that take longer than 2 minutes.
	/*var allowed_time_seconds = 120;
	if (client.json.action == 'submit' || client.json.action == 'validate')
	{
	   var lab_id = client.json.id;
	   var specification = client.json.experimentSpecification;
	
	   var responseFunction = (function(response_client)
	   {
	        return function(obj, err)
			{
	           if (obj['accepted'] == true)
	           {
	               if (parseInt(obj['estWait']) <= allowed_time_seconds)
	               {
	                   if (client.json.action == 'validate')
	                       core.sendReplyToClient(response_client, obj);
	                   else
	                       core.receiveDataFromClient(client);
	               }
	               else
	                   core.rejectDataFromClient(client);
	           }
			   else
			       core.sendReplyToClient(response_client, obj);
	        };
	   })(client);
	   core.sendActionToServer({id:lab_id, action:'validate', experimentSpecification:specification}, responseFunction);
	}
	else
	{
		core.receiveDataFromClient(client);
	}*/

	//Pass through
	core.receiveDataFromClient(client);
}

//Do not modify below this line.
module.exports.receiveDataFromClient = receiveDataFromClient;
module.exports.experimentCompleted = experimentCompleted;