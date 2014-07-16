js_validator = require("../core/js_validator");

/**
 * Creates a JavaScript that can be executed in the JSEngine.
 * @param experimentSpecification
 * @param callback
 */
exports.javaScriptFromJSONSpecification = function(experimentSpecification, callback) {
	
    var x_values = experimentSpecification["xvalues"];
    var required_values = x_values[0].split(",");

    var javaScript = "var y_values = []; var i = 0;";
    javaScript += "var x_values = " + JSON.stringify(required_values) + ";";
    var nextValue = function()
    {
        if (i<x_values.length)
        {
            var y_value = sin(parseFloat(x_values[i]), function(json){
                var y_value = json;
                y_values.push(y_value);
                i++;
                nextValue();
            });
        }
        else exit({y:y_values});


        /*
		lightOn({time:1}, function(){
			lightOff({time:0.2}, function(){
				i++;
				if (i > 40)
					exit({});
				nextValue();
			});
		});
		*/
    }

	javaScript += "var nextValue = " + nextValue.toString() + ";\n";
    javaScript += "nextValue();"
    callback({accepted: true, script: javaScript});
};

exports.executeJSONSpecification = function(experimentSpecification, validate, callback) {

    var x_values = experimentSpecification["xvalues"];
    var x_array = x_values.split(",");
    var y_array = [];
    var time = 0.0;

    var nextValue = function()
    {
        if (x_array.length > 0)
        {
            var x_value = x_array[0];
            x_array.shift();
            js_validator.runAction("sin", x_value, validate, function (y_array) { 
				return function(json){
	                if (json.success != true)
	                {
	                    return callback({success: false, errorMessage:"sin action failed"}, {});
	                } else {
						time+=json.options.time;
						if (time > 60)
							return callback({success: false, errorMessage:"timeout"}, {});

	                    var y_value = json.json;
	                    y_array.push(y_value);
	                    nextValue();
	                }
            	};
			}(y_array));
        }
        else return callback({success:true, time:time},y_array);
    }
    nextValue();
};