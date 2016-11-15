HW3
=========================

### Setup

 - [Screencast](https://www.youtube.com/watch?v=Qnph0_ACDxc)
 - Run `sudo npm install` to install the dependencies.
 - Run `node main.js` to start the Proxy server.

### An expiring cache

Create two routes, `/get` and `/set`.

When `/set` is visited, set a new key, with the value:
> "this message will self-destruct in 10 seconds".

Use the expire command to make sure this key will expire in 10 seconds.

When `/get` is visited, fetch that key, and send value back to the client: `res.send(value)` 

```
app.get('/set', function(req, res){
	client.set("Zhewei", "Awesome");
	client.expire("Zhewei", 10);
	console.log("===================================");
	res.send("Key set. Only last for 10 seconds.");
});

app.get('/set/:key', function(req, res){
	client.set("Zhewei", req.params.key);
	client.expire("Zhewei", 10);
	//Must have res.send(), otherwise server will waiting response forever...
	console.log("===================================");
	res.send("Key set. Only last for 10 seconds."); 
});

app.get('/get', function(req, res){
	client.get("Zhewei", function(err,value){ 
		res.send(value);
		console.log(value);
		console.log("===================================");
	});
});
```


### Recent visited sites

Create a new route, `/recent`, which will display the most recently visited sites.

There is already a global hook setup, which will allow you to see each site that is requested:

```
app.use(function(req, res, next) 
{
	console.log(req.method, req.url);
	// redis key should be string
	client.lpush("recentUrl", req.url);
	// Keep 5 recent urls
	client.ltrim("recentUrl", 0, 4);
	
	next(); // Passing the request to the next handler in the stack.
});
```

Use the lpush, ltrim, and lrange redis commands to store the most recent 5 sites visited, and return that to the client.

```
app.get('/recent', function(req, res){
	client.lrange("recentUrl", 0, -1, function(err, value){
		console.log(value);
		console.log("===================================");
		res.send(value);
	});
});
```

### Cat picture uploads: queue

Implement two routes, `/upload`, and `/meow`.
 
A stub for upload and meow has already been provided.

Use curl to help you upload easily.

	curl -F "image=@./img/morning.jpg" localhost:3000/upload

Have `upload` store the images in a queue.  Have `meow` display the most recent image to the client and *remove* the image from the queue. Note, this is more like a stack.

```
app.get('/meow', function(req, res) {
	client.lrange("imageStack", 0, -1, function(err, items){
		if(err) throw err
		res.writeHead(200, {'content-type':'text/html'});
		items.forEach(function (imagedata) 
		{
			res.write("<h1>\n<img src='data:my_pic.jpg;base64,"+imagedata+"'/>");
		});
		console.log("===================================");
		res.end();
	});
})
```

### Spawn/destory/list server

 - Implement a new command `spawn`, which will create a new app server running on another port.
```
app.get('/spawn', function(req, res) {
	// if certain port is not used, then creating a server listening this port
	client.scard("serverSet", function(err, value){
		if(err) throw err
	  	serverSetLen = value;
		console.log("serverSetLen: " + serverSetLen);
		console.log("---------------");

		var server = app.listen(portNum, function() {
			var host = server.address().address
			var port = server.address().port
			serverSetLen += 1;
			client.sadd("serverSet", 'http://0.0.0.0:' + portNum);
			console.log('A new app listening at http://%s:%s', host, port)
			console.log("serverSetLen: " + serverSetLen);
			console.log("===================================");
		});
		serverHashMap.set(portNum, server);
	});
	portNum += 1;
	res.end();
});
```

 - Implement a new command `destroy`, which will destroy a random server. Destroying all servers is undefined behavior.
 ```
 app.get('/destroy', function(req, res) {
	client.scard("serverSet", function(err, value){
		// If more than one server in redis set, we can delete random one
		// Destroying all servers is undefined behavior.
		if(err) throw err
		serverSetLen = value;
		if(serverSetLen > 1){
			client.spop("serverSet", function(err, serverDetail){
				if(err) throw err
				var port = parseInt(serverDetail.match(/[0-9]{4}/)[0]);
				var server = serverHashMap.get(port);
			  	// var server = app.listen(serverDetail.match(/[0-9]{4}/)[0]);
				server.close(function(err, value){
					if(err) throw err
					serverSetLen -= 1;
					console.log("A server (" + serverDetail + ") is deleted successfully.");
	  				console.log("serverSetLen: " + serverSetLen);
					console.log("===================================");
				});
			});
		} else {
			console.log('There is only one server left, you cannot delete it.');
			console.log("===================================");
		}
		res.send();
	})
})
```

 - Available servers can be seen by `listservers` command.
 ```
 app.get('/listservers', function(req, res) {
	client.smembers("serverSet", function(err, servers){
		if(err) throw err
		res.writeHead(200, {'content-type':'text/html'});
		servers.forEach(function (serverDetail){
			res.write("<p>" + serverDetail + "</p>");
		});
		console.log("===================================");
		res.end();
	});
});
```

### Proxy server

Create a proxy that will uniformly deliver requests to available servers. E.g., if a visit happens to `/` then toggle between `localhost:3000`, `localhost:3001`, etc.  Use redis to look up which server to resolve to.

```
// HTTP Proxy
var proxy = httpProxy.createProxyServer({});
var proxyServer = http.createServer(function(req, res){
	client.spop("serverSet", function(err, serverDetail){
		console.log("Current proxy server is " + serverDetail);
		proxy.web(req, res, {target: serverDetail});
		client.sadd("serverSet", serverDetail);
	});
});
proxyServer.listen(8080);
console.log("The proxy server delivers requests to http://%s:%s", proxyServer.address().address, proxyServer.address().port);
```
