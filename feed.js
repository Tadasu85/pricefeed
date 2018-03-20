const fs = require("fs");
const muse = require('museblockchain-js');
const request = require("request");

var config = JSON.parse(fs.readFileSync("config.json"));

muse.config.set('websocket','wss://api.muse.blckchnd.com');

setInterval(startProcess, config.interval * 60 * 1000);
startProcess();

function startProcess() {
    // Load price from coinmarketcap.com if no exchanges are specified.
    loadPriceCMC(function (price) {
      publishFeed(price, 0);
    }, 0);
}

function publishFeed(price, retries) {
  var peg_multi = config.peg_multi ? config.peg_multi : 1;
  var exchange_rate = { base: price.toFixed(6) + ' 2.28.2', quote: (1 / peg_multi).toFixed(6) + ' 2.28.0' };

  log('Broadcasting feed_publish transaction: ' + JSON.stringify(exchange_rate));

  muse.broadcast.feedPublish(config.active_key, config.account, exchange_rate, function (err, result) {
    if (result && !err) {
      log('Broadcast successful!');
    } else {
      log('Error broadcasting feed_publish transaction: ' + err);

      if (retries == 5)
        failover();

      if (retries < 2)
        setTimeout(function () { publishFeed(price, retries + 1); }, 10 * 1000);
    }
  });
}

function loadPriceCMC(callback, retries) {
  log('Loading MUSE price...');

  // Load the price feed data
  request.get('https://api.coinmarketcap.com/v1/ticker/bitshares-music/', function (e, r, data) {
    try {
      var muse_price = parseFloat(JSON.parse(data)[0].price_usd);
      log("Loaded MUSE price from CoinMarketCap: " + muse_price);

      if (callback)
        callback(muse_price);
    } catch (err) {
      log('Error loading MUSE price from CoinMarketCap: ' + err);

      if(retries < 2)
        setTimeout(function () { loadPrice(callback, retries + 1); }, 10 * 1000);
    }
  });
}

function failover() {
  if (config.rpc_nodes && config.rpc_nodes.length > 1) {
    var cur_node_index = config.rpc_nodes.indexOf(muse.api.options.url) + 1;

    if (cur_node_index == config.rpc_nodes.length)
      cur_node_index = 0;

    var rpc_node = config.rpc_nodes[cur_node_index];

    muse.api.setOptions({ transport: 'http', uri: rpc_node, url: rpc_node });
    utils.log('');
    utils.log('***********************************************');
    utils.log('Failing over to: ' + rpc_node);
    utils.log('***********************************************');
    utils.log('');
  }
}

function log(msg) { console.log(new Date().toString() + ' - ' + msg); }
