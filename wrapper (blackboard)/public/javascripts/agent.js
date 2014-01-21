//These variables are automatically set by the agent
var broker = {
	host: agent_host, 
	port: agent_port
};

//------------------------------------------------------------------------------------------------
function tokenString()
{
	var token = token_string;
	return '&uid=' + token['u'] + '&token=' + token['t'];
}

function genericAction(action, call_func)
{
	$.ajax
	({
		dataType: 'jsonp',
		data: "action="+action+tokenString(),          
		jsonp: 'callback',
		url: 'http://'+ broker.host + ":"+ broker.port+'/jsonp?callback=?',                     
		success: function callback(data)
		{
			call_func(data);
		}
	});
}

//Wrappers
function getBrokerInfo(call_func)
{
	genericAction("getBrokerInfo", call_func);
}	
function getLabList(call_func)
{
	genericAction("getLabList", call_func);
}
function getLabConfiguration(lab_id, call_func)
{
	genericAction("getLabConfiguration&id="+lab_id, call_func);
}
function getLabStatus(lab_id, call_func)
{
	genericAction("getLabStatus&id="+lab_id, call_func);
}
function getEffectiveQueueLength(lab_id, call_func)
{
	genericAction("getEffectiveQueueLength&id="+lab_id, call_func);
}
function validateExperiment(lab_id, experimentID, experimentSpecification, call_func)
{
	genericAction("validate&id="+lab_id + "&experimentSpecification="+ experimentSpecification+"&experimentID="+ experimentID, call_func);
}
function submitExperiment(lab_id, experimentID, experimentSpecification, call_func)
{
	genericAction("submit&id="+lab_id + "&experimentSpecification="+ experimentSpecification+"&experimentID="+ experimentID, call_func);
}

//Utils
function addToXml(xml, key, val, type)
{
	xml += ("<"+ key + ">"+ val + "</"+ key + ">");
	return xml;
}