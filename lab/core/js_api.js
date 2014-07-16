XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
exports.api = {

	//Async ONLY
    sendAction: function(location, body, callback)
    {
        var xhr = new XMLHttpRequest();
        xhr.open('post', location, true);//(typeof callback !== 'undefined'));
        xhr.setRequestHeader("Content-Type", "application/json");

        if (typeof callback !== 'undefined')
        {
            xhr.onerror = function (e) {
                callback('', xhr.statusText);
            };

            xhr.onload = function () {
                callback(xhr.responseText, '');
            }
        }

        xhr.send(body);
        //return xhr.responseText;
    },
	/*
	do NOT enable this
	debug: function(message)
 	{
   		console.log(message);
 	}
	*/	
}