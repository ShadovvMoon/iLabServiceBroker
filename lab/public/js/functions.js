function generateRandom(page_element_id)
{
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for( var i=0; i < 32; i++ )
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	document.getElementById(page_element_id).value = text;
}