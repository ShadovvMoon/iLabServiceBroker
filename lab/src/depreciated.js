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

/*db_module.flush = function(callback) {
	//Get the port number from the database
	settings_database.get('port', (function(callback){ return function(err, returned_port){
			settings_dictionary['port'] = returned_port;
			//Set the default port if missing
			if (typeof settings_dictionary['port'] === 'undefined')
			{
				settings_dictionary['port'] = default_port;
				settings_database.set('port', settings_dictionary['port']);
			}

			//Get the GUID from the settings database
			settings_database.get('guid', (function(callback){
				return function(err, returned_guid){
					settings_dictionary['guid'] = returned_guid;
					//Generate a new guid if missing
					if (!settings_dictionary['guid'])
					{
						var guid = require('crypto').randomBytes(16).toString('hex');
						settings_dictionary['guid'] = guid;
						settings_database.set('guid', settings_dictionary['guid']);
					}
					
					//Get the random salt from the settings database
					settings_database.get('salt', (function(callback){
						return function(err, returned_salt){
							settings_dictionary['salt'] = returned_salt;
							//Generate a new salt if missing
							if (!settings_dictionary['salt'])
							{
								var salt = require('crypto').randomBytes(48).toString('hex');
								settings_dictionary['salt'] = salt;
								settings_database.set('salt', settings_dictionary['salt']);
							}
							callback();
						}
					})(callback));	
				}
			})(callback));	
		}
	})(callback));
}
*/
