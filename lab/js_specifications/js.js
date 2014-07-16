js_validator = require("../core/js_validator");

/**
 * Creates a JavaScript that can be executed in the JSEngine.
 * @param experimentSpecification
 * @param callback
 */
exports.javaScriptFromJSONSpecification = function(experimentSpecification, callback) {

    var x_values = experimentSpecification["xvalues"];
    var required_values = x_values[0].split(",");

    var javaScript = "var y_array = [];\n";
    javaScript += "var x_array = [" + required_values.join(",") + "];\n";

    var nextValue = function()
    {
        if (x_array.length > 0)
        {
            var x_value = x_array[0];
            x_array.shift();
            sin(x_value, function(y_value) {
                y_array.push(y_value);
                nextValue();
            });
        }
        else exit({y: y_array});
    }

    javaScript += "var nextValue = " + nextValue.toString() + ";\n";
    javaScript += "nextValue();"
    callback({accepted: true, script: javaScript});
};

exports.executeJSONSpecification = function(experimentSpecification, validate, callback) {

    var x_values = experimentSpecification["xvalues"];
    var x_array = x_values[0].split(",");
    var y_array = [];
    var time = 0.0;

    var nextValue = function()
    {
        if (x_array.length > 0)
        {
            var x_value = x_array[0];
            x_array.shift();
            js_validator.runAction("sin", x_value, validate, function (y_array) { return function(json){
                if (json.success != true)
                {
                    return callback({success: false, errorMessage:"sin action failed"}, {});
                }
                else
                {
                    if (validate)
					{
                        time+=json.options.time;
						if (time > 60)
							return callback({success: false, errorMessage:"timeout"}, {});
					}

                    var y_value = json.json;
                    y_array.push(y_value);
                    nextValue();
                }
            };}(y_array));
        }
        else return callback({success:true, time:time},{y: y_array});
    }
    nextValue();
};