/*SerialPort = require('serialport');
var serialPort = new SerialPort.SerialPort("/dev/tty.usbmodem1421", {
	baudrate: 9600,
	parser: SerialPort.parsers.readline('\r\n')
});
*/
exports.actions = {

/*
	lightOn: function(options, validate, callback)
    {
		var time = parseFloat(options['time']);

        //Are we only validating this function?
        if (validate)
        {
            callback({success:true, time: time});
            return;
        }
		serialPort.write(new Buffer([1]));

       setTimeout(function(callback){return function () {
			callback({success:true}, undefined);
        };}(callback), time*1000);
		
    },
	lightOff: function(options, validate, callback)
    {
		var time = parseFloat(options['time']);

        //Are we only validating this function?
        if (validate)
        {
            callback({success:true, time: time});
            return;
        }
		serialPort.write(new Buffer([0]));

       	setTimeout(function(callback){return function () {
			callback({success:true}, undefined);
        };}(callback), time*1000);
    },
*/
	move: function(options, validate, callback)
    {
        //Extract input parameters
        var input = parseFloat(options);

        //Validation
        if (!(input >= -1.0 && input <= 100.0))
        {
            callback({success:false, info:"You can only enter an input value between -1 and 1"}, undefined);
            return;
        }

        //Are we only validating this function?
        if (validate)
        {
            callback({success:true, time: Math.abs(input)});
            return;
        }

        //Execute the action. Sin takes 1 second
        setTimeout(function(callback){return function () {
			callback({success:true}, undefined);
        };}(callback), Math.abs(input));
    },

    /**
     * Returns the sin of input
     * @params input - the input value
     * @validate -2pi <= input <= 2pi
     */
    sin: function(options, validate, callback)
    {
        //Extract input parameters
        var input = parseFloat(options);

        //Validation
        if (!(input >= -2*Math.PI && input <= 2*Math.PI))
        {
            callback({success:false, info:"You can only enter an input value between -2pi and 2pi (" + options + ")"}, undefined);
            return;
        }

        //Are we only validating this function?
        if (validate)
        {
            callback({success:true, time: 0.1});
            return;
        }

        //Execute the action. Sin takes 1 second
        setTimeout(function(callback){return function () {
            var returned_value = Math.sin(input);
            callback({success:true}, returned_value);
        };}(callback), 100);
    },

    /**
     * Returns the cos of input
     * @params input - the input value
     * @validate -2pi <= input <= 2pi
     */
    cos: function(options, validate, callback)
    {
        //Extract input parameters
        var input = parseFloat(options);

        //Validation
        if (!(input >= -2*Math.PI && input <= 2*Math.PI))
        {
            callback({success:false, info:"You can only enter an input value between -2pi and 2pi"}, null);
            return;
        }

        //Are we only validating this function?
        if (validate)
        {
            callback({success:true, time: 2.0});
            return;
        }

        //Execute the action. Cos takes 2 seconds
        setTimeout(function(callback){return function () {
            var returned_value = Math.cos(input);
            callback({success:true}, returned_value);
        };}(callback), 2000);
    }

};