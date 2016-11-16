var redis   = require('redis');
var http  = require('http');
var httpProxy = require('http-proxy');

// REDIS
var client = redis.createClient(6379, 'redis', {});

// HTTP Proxy
var proxy = httpProxy.createProxyServer({});
var proxyServer = http.createServer(function(req, res){
  client.spop("serverSet", function(err, serverPort){
    // get the last character of port
    var appNum = parseInt(serverPort.substr(-1)) + 1;
    console.log("Current proxy server is app_" + appNum + " (http://0.0.0.0:" + serverPort + ")");
    proxy.web(req, res, {target: "http://hw4_app_" + appNum + ":3000"});
    client.sadd("serverSet", serverPort);
  });
});
proxyServer.listen(8080);
console.log("The proxy server delivers requests to http://%s:%s", proxyServer.address().address, proxyServer.address().port);