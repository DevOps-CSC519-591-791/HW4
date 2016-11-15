var http      = require('http');
var httpProxy = require('http-proxy');
var exec = require('child_process').exec;

var infrastructure =
{
  setup: function()
  {
    // Proxy.
    var options = {};
    var proxy   = httpProxy.createProxyServer(options);
    var server  = http.createServer(function(req, res)
    {
      client.spop("serverSet", function(err, serverDetail){
        console.log("Current proxy server is " + serverDetail);
        proxy.web(req, res, {target: serverDetail});
        client.sadd("serverSet", serverDetail);
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