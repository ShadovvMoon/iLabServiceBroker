$(function()
{
  
  var showInfo = function(message)
  {
    $('div.progress').hide();
    $('strong.message').text(message);
	$('normal.text').text(message);
    $('div.alert').show();
  };
  
  $('input[type="submit"]').on('click', function(evt)
  {
    evt.preventDefault();

    //$('div.progress').show();
    var formData = new FormData();

    var dropDown = document.getElementById('experiment');
	var selectedServer = dropDown.options[dropDown.selectedIndex].value;

	console.log("File: " + selectedServer);

	formData.append('server', selectedServer);

	var xhr = new XMLHttpRequest();
	xhr.open('post', '/server', true);
	
	xhr.upload.onprogress = function(e)
	{
      if (e.lengthComputable) {
        var percentage = (e.loaded / e.total) * 100;
        $('div.progress div.bar').css('width', percentage + '%');
      }
    };

	xhr.onerror = function(e)
	{
	  	showInfo('An error occurred while submitting the form. Maybe your file is too big');
	};
    
    xhr.onload = function()
	{
      	$('div.progress').hide();

		var xmlDoc = xhr.responseText;
		var jsonResponse = JSON.parse(xmlDoc);

		var labConfig = jsonResponse['labConfiguration'];
		var labName = labConfig['$']['title'];

		var textHtml = "<br/>";

		console.log(jsonResponse);

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
	
					textHtml+= "<a href=\""+ urls[a]+"\">link</a> ";
					hasLink = true;
				}
			}

			if (hasLink)
			{
				textHtml+= "<br/>";
			}
		}

		$('div.progress').hide();
    	$('strong.message').text(labName);
		$('normal.text').html(textHtml);
    	$('div.alert').show();
    };
    
    xhr.send(formData);

	/*
    formData.append('myFile', file);
    
    var xhr = new XMLHttpRequest();
    
    xhr.open('post', '/server', true);
    
    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        var percentage = (e.loaded / e.total) * 100;
        $('div.progress div.bar').css('width', percentage + '%');
      }
    };
    

    xhr.onerror = function(e) {
      showInfo('An error occurred while submitting the form. Maybe your file is too big');
    };
    
    xhr.onload = function() {
      showInfo("");
    };
    
    xhr.send(formData);
    */
  });
  
});