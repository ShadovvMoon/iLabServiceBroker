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

database = require('./database')
calendar_module = module.exports;

var cached_calendar = undefined;
calendar_module.flushCalendar = function() {
    defines.verbose("flushing calendar...");
    var stored_cache = database.valueForKey("calendar", "schedule", undefined);
	stored_cache = (typeof stored_cache !== 'undefined') ? stored_cache:{};

    //Clear the old calendar
    cached_calendar = [];

    var i;
    for (i=0; i < stored_cache.length; i++)
    {
        var event = stored_cache[i];
        cached_calendar.push({
            title: event.title,
            start: Date.parse(event.start),
            end: Date.parse(event.end),
            type: event.accessType,
            allDay: event.allDay
        });
    }
}
calendar_module.updateCalendar = function(calendar) {
    database.setValueForKey("calendar", "schedule", calendar, undefined);
    calendar_module.flushCalendar();
}
calendar_module.setupExpress = function (app) {
    calendar_module.flushCalendar();
	defines.prettyLine("calendar", "loaded");
}

calendar_module.hasAccess = function(broker, estRuntime) {
    var now = new Date();
    var end = new Date();
    end.setSeconds(end.getSeconds() + estRuntime);

    var intersection = false;
    var explicitPermission = false;

    var i;
    for (i = 0; i < cached_calendar.length; i++) {
        var event = cached_calendar[i];

        //Will any part of this experiment execute during the event?
        if (now >= event.start && now <= event.end ||
            end >= event.start && end <= event.start ||
            now <= event.start && end >= event.end) {
            intersection = true;
            if (event.title == broker) {
                explicitPermission = true;
                break;
            }
        }
    }

    //Cleanup any old events
    //...

    //Return if we have permission
    return (!intersection || explicitPermission);
}