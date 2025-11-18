


// Basic WebSocket setup with Finnhub official client
const finnhub = require('finnhub');
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'YOUR_FINNHUB_API_KEY_HERE';

// Initialize the API client
const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = FINNHUB_API_KEY;
const finnhubClient = new finnhub.DefaultApi();

function fetchStockCandles(symbol) {
  return new Promise((resolve) => {
    const to = Math.floor(Date.now() / 1000);
    const from = to - (30 * 24 * 60 * 60); // Last 30 days
    
    finnhubClient.stockCandles(symbol, 'D', from, to, (error, data, response) => {
      if (error) {
        resolve({ symbol, error: error.message });
      } else if (data && data.c && data.c.length > 0) {
        const candles = [];
        for (let i = 0; i < data.c.length; i++) {
          candles.push({
            time: new Date(data.t[i] * 1000).toISOString().split('T')[0],
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
            volume: data.v[i]
          });
        }
        resolve({ symbol, candles });
      } else {
        resolve({ symbol, error: 'No candle data found' });
      }
    });
  });
}

function fetchStockPrice(symbol) {
  return new Promise((resolve) => {
    finnhubClient.quote(symbol, (error, data, response) => {
      if (error) {
        resolve({ symbol, error: error.message });
      } else if (data && typeof data.c === 'number' && data.c > 0) {
        resolve({
          symbol: symbol,
          price: data.c,
          time: new Date().toISOString()
        });
      } else {
        resolve({ symbol, error: 'No price data found' });
      }
    });
  });
}

module.exports = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    console.log('WebSocket client connected');

    // Listen for stock price requests
    socket.on('getStockPrice', async (symbol) => {
      const result = await fetchStockPrice(symbol);
      socket.emit('stockPrice', result);
    });

    // Listen for candlestick data requests
    socket.on('getStockCandles', async (symbol) => {
      const result = await fetchStockCandles(symbol);
      socket.emit('stockCandles', result);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket client disconnected');
    });
  });
};
