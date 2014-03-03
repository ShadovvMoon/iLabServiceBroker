var lab_id = "Radioactivity 1";
var is_running = false;

var refresh_counter = 0;
var wait_time = 0;
var biggest_wait = 0;
var delayed_wait = 0;

var running_experiment = false;
function retreiveResults() //Allows for the inaccuracies of the experiment
{
	retrieveResult(lab_id, experimentID, function(results)
	{
		console.log(results);
		if (results['statusCode'] == 2)
		{
			setTimeout(retreiveResults, 5000);
		}	
		else
		{
			//Plot the results
			var result_string = results['experimentResults'];
			
			var parser=new DOMParser();
 			var xmlDoc=parser.parseFromString(result_string,"text/xml");
			var obj = xmlToJson(xmlDoc);

			var graph_data = [];

			//Repeat for each data vector
			console.log(obj);

			var results = obj['experimentResult'];
			var data_vectors = results['dataVector'];
			var i = 0;
			for (i=0; i < data_vectors.length; i++)
			{
				var vector = data_vectors[i];
				var results = vector['#text'];
				var distance = vector['@attributes']['distance'];

				var Sum = 0.0;
				var average = 0.0;
				var scores = results.split(',');
				console.log(results);
				for(var x = 0; x < scores.length; x ++)
				{
				 	Sum = Sum + parseFloat(scores[x]);  //or Sum += scores[x];
				}
				console.log(Sum);
				console.log(scores.length);
				average = Sum / scores.length;  //length of the array scores is in scores.length
				graph_data.push([distance,average]);
			}

			var options = {
				series: {
					lines: { show: true },
					points: { show: true }
				},
				xaxis: { axisLabel: "Distance",axisLabelUseCanvas: true},
				yaxis: { axisLabel: "Radiation",axisLabelUseCanvas: true},
				grid: {
					hoverable: true //IMPORTANT! this is needed for tooltip to work
				},
				tooltip: true,
				tooltipOpts: {
					content: "'%s' of %x.1 is %y.4",
					shifts: {
						x: -60,
						y: 25
					}
				}
			};

			console.log(graph_data);
			var plotObj = $.plot( $("#flot-chart-line"),[{ data: graph_data, label:''}],options );
			switchResult();
		}
	});
}

function switchInterface()
{
	document.getElementById('experiment-setup').style.display = 'none';
	document.getElementById('experiment-view').style.display = 'block';
}

function switchResult()
{
	running_experiment = false;
	document.getElementById('experiment-setup').style.display = 'none';
	document.getElementById('experiment-view').style.display = 'none';
	document.getElementById('experiment-results').style.display = 'block';
}

function testButton()
{
	biggest_wait = 130;
	wait_time = biggest_wait;
}

var experimentID = -1;
function runExperiment()
{
	//CreateXmlSpecification
	var selected_source_name = document.getElementById("source-list").value;
	var selected_duration    = document.getElementById("experiment-duration").value;
	var selected_repeats 	 = document.getElementById("experiment-repeats").value;
	var selected_distance	 = document.getElementById("experiment-distance").value;

	var xml_string = "";
	xml_string = addToXml(xml_string, "setupName", "Radioactivity versus Distance");
	xml_string = addToXml(xml_string, "setupId", "RadioactivityVsDistance");
	xml_string = addToXml(xml_string, "sourceName", selected_source_name);
	xml_string = addToXml(xml_string, "absorberName", "None");
	xml_string = addToXml(xml_string, "distance", selected_distance);
	xml_string = addToXml(xml_string, "duration", selected_duration);
	xml_string = addToXml(xml_string, "repeat", selected_repeats);

	//First validate the experiment
	var runButton = document.getElementById("run-experiment-button");
	if (is_running)
	{
		runButton.innerHTML  = "Submitting Experiment...";
		runButton.className  = "btn btn-success disabled";
		submitExperiment(lab_id, '1', xml_string, function(data)
		{
			console.log(data);
			if (data['vReport'][0]['accepted'] == 'true')
			{
				runButton.innerHTML = "Submitted";

				window.chart.update(100);
				delayed_wait = data['vReport'][0]['estRuntime'];
				biggest_wait = data['wait'][0]['estWait'];
				experimentID = data['experimentID'];
				wait_time = biggest_wait;
	
				var timer2 	= document.getElementById('experiment-readable-id');
				timer2.innerHTML = "experiment id " + experimentID;

				running_experiment = true;
			}
		})
	}
	else
	{
		var runButton = document.getElementById("run-experiment-button");
		runButton.innerHTML  = "Validating...";
		runButton.className  = "btn btn-primary disabled";

		validateExperiment(lab_id, '1', xml_string, function(data)
		{
			if (data['accepted'] == 'true')
			{
				runButton.innerHTML = "Run Experiment";
				runButton.className = "btn btn-success";

				is_running = true;
			}
			else
			{
				console.log(data);
				runButton.innerHTML = "Validation failed";
				runButton.className = "btn btn-primary";
			}
		});
	}
}

function updateWait()
{
	wait_time--;
	if (wait_time < 0)
		wait_time = 0;

	var timer 	= document.getElementById('experiment-readable-time');
	if (timer != null)
	{
		if (running_experiment)
			switchInterface();

		if (delayed_wait == -2)
		{
			return;
		}
		if (delayed_wait == -1)
		{
			if (wait_time == 0)
			{
				timer.innerHTML = "Retreiving results";
				
				//Update the status message
				if (experimentID != -1)
				{
					retreiveResults();
				}

				delayed_wait = -2;
			}
			else
				timer.innerHTML = "Your experiment is running and will finish in " + wait_time + " seconds";
		}
		else if (delayed_wait != 0 && wait_time == 0)
		{
			biggest_wait = delayed_wait;
			wait_time = biggest_wait;
			delayed_wait = -1;

			timer.innerHTML = "Your experiment is running and will complete in " + wait_time + " seconds";
		}
		else 
			timer.innerHTML = "Your experiment will start in "+ wait_time + " seconds";
	}


	timer = document.getElementById('wait_timer');
	if (timer != null)
	{
		timer.innerHTML = "Wait: "+ wait_time;
		window.chart.update((wait_time/biggest_wait)*100);

		/*
		refresh_counter++;
		if (refresh_counter >= 10)
		{
			refresh_counter=0;

			//Update the status message
			getLabStatus(lab_id, function(status)
			{
				getEffectiveQueueLength(lab_id, function(queue)
				{
					//Update the queue length
					var status_message = document.getElementById('status_message');
					if (status_message != null)
					{
						status_message.innerHTML = status["labStatusMessage"];
					}
	
					var queue_length = document.getElementById('queue_length');
					if (queue_length != null)
					{
						queue_length.innerHTML = "Size: " + queue["effectiveQueueLength"];
					}

					wait_time 	 = queue["estWait"];
				});
			});
		}
		*/
	}
}

getBrokerInfo(function(data)
{
	getLabList(function(labs)
	{
		getLabConfiguration(lab_id, function(configuration)
		{
			getLabStatus(lab_id, function(status)
			{
				getEffectiveQueueLength(lab_id, function(queue)
				{
					var labConfig = configuration['labConfiguration'];
					var labName = labConfig['$']['title'];
			
					var textHtml = "<br/>";

					//Add any photos for the laboritory
					var labCamera = labConfig['navmenuPhoto'];
					for (var i = 0; i < labCamera.length; i++)
					{
						var urls = labCamera[i]['image'];
						for (var a = 0; a < urls.length; a++)
						{
							textHtml+= "<img src=\""+ urls[a]+"\"/> ";
						}
					}
					textHtml+= "<br/>";
					textHtml+= "<br/>";
			
					//Add any lab camera links
					var labCamera = labConfig['labCamera'];
					for (var i = 0; i < labCamera.length; i++)
					{
						var hasLink = false; 
						var urls = labCamera[i]['url'];
						for (var a = 0; a < urls.length; a++)
						{
							if (urls[a] != "")
							{
								if (!hasLink)
								{
									textHtml+= "Live camera " + (i+1) + ": ";
								}
				
								textHtml+= "<a href=\""+ urls[a]+"\">link</a><br/>";
								hasLink = true;
							}
						}
			
						if (hasLink)
						{
							textHtml+= "<br/>";
						}
					}
			
					//Add status messages
					console.log(configuration);

					wait_time = queue["estWait"];
					textHtml+= "<p><b>Queue</b><br/><span id=\"queue_length\">Size: "+
					queue["effectiveQueueLength"]+"</span><br/><span id=\"wait_timer\">Wait: "+queue["estWait"]+"</span></p>";

					textHtml+= "<p><b>Status</b><br/><span id=\"status_message\">"+ status["labStatusMessage"]+"</span></p>";

					$('div.progress').hide();
			    	$('strong.message').text(labName);
					$('normal.text').html(textHtml);
			    	$('div.alert').show();
				});
			});
		});
	});
});

//Regular updates to the wait time
setInterval(updateWait,1000);