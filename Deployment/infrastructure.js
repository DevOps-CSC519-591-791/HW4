var redis   = require('redis');
var http      = require('http');
var httpProxy = require('http-proxy');
var exec = require('child_process').exec;
// REDIS
var client = redis.createClient(6379, 'redis', {});

var infrastructure =
{
  setup: function()
  {
    // Proxy.
    var options = {};
    var proxy   = httpProxy.createProxyServer(options);
    var server  = http.createServer(function(req, res)
    {
      client.spop("serverSet", function(err, serverPort){
        console.log("Current proxy server is http://0.0.0.0:" + serverPort);
        proxy.web(req, res, {target: app:serverPort});
        client.sadd("serverSet", serverPort);
      });
    });

    server.listen(8080);
  },

  teardown: function()
  {
    exec('forever stopall', function()
    {
      console.log("infrastructure shutdown");
      process.exit();
    });
  },
}

infrastructure.setup();

// Make sure to clean up.
process.on('exit', function(){infrastructure.teardown();} );
process.on('SIGINT', function(){infrastructure.teardown();} );
process.on('uncaughtException', function(err){
  console.error(err);
  infrastructure.teardown();} );