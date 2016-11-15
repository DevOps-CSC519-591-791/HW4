var redis 	= require('redis');
var multer  = require('multer');
var express = require('express');
var fs      = require('fs');
var app 	= express();
var http 	= require('http');
var HashMap = require("hashmap");
var serverHashMap = new HashMap();
var portNum	= 3000;
var serverSetLen = 0;
// REDIS
var client = redis.createClient(6379, 'redis', {});

///////////// WEB ROUTES
// Add hook to make it easier to get all visited URLS.
// output example
// "GET /get", "GET" is the req.method, "/get" is the req.url
app.use(function(req, res, next) 
{
	console.log(req.method, req.url);

	// ... INSERT HERE.
	// redis key should be string
	client.lpush("recentUrl", req.url);
	// Keep 5 recent urls
	client.ltrim("recentUrl", 0, 4);
	
	next(); // Passing the request to the next handler in the stack.
});

app.get('/', function(req, res) {
	console.log("===================================");
	res.send('hello world!');
});

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

app.get('/recent', function(req, res){
	client.lrange("recentUrl", 0, -1, function(err, value){
		console.log(value);
		console.log("===================================");
		res.send(value);
	});
});

// Multer is a node.js middleware for handling multipart/form-data,
// which is primarily used for uploading files.
app.post('/upload',[ multer({ dest: './uploads/'}), function(req, res){
   console.log(req.body); // form fields
   console.log(req.files); // form files

   if( req.files.image )
   {
	   fs.readFile( req.files.image.path, function (err, data) {
	  		if(err) throw err;
	  		var img = new Buffer(data).toString('base64');
	  		//store images to Redis
	  		client.lpush("imageStack", img);
	  		// Keep 3 recent images in stack
	  		client.ltrim("imageStack", 0, 2);
	  		console.log('Upload one image successfully!');
			console.log("===================================");
		});
	}
   res.status(204).end();
}]);

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

// HTTP SERVER
var server = app.listen(portNum, function() {
  var host = server.address().address
  var port = server.address().port
  // Delete existing key
  client.del("serverSet");
  client.sadd("serverSet", 'http://0.0.0.0:' + port);
  // asynchronously obtain length of the server list
 //  client.scard("serverSet", function(err, value){
	// if(err) throw err
 //  	serverSetLen = value;
 //  	console.log("serverSetLen: " + serverSetLen);
 //  });

  console.log('Queues app listening at http://%s:%s', host, port)
});
serverHashMap.set(3000, server);