var queueRefresh = 2000;
function pollQueue() {

	setTimeout(pollQueue, queueRefresh);
}

//Automatically poll the queue every few seconds
setTimeout(pollQueue, queueRefresh);