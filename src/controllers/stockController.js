const axios = require('axios');
require('dotenv').config();

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

exports.getPrice = async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }
  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
      params: { symbol, token: FINNHUB_API_KEY }
    });
    const data = response.data;
    // Finnhub returns: c (current), t (timestamp), o (open), h (high), l (low), pc (prev close)
    res.json({
      symbol,
      price: data.c,
      time: data.t ? new Date(data.t * 1000).toISOString() : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch price', details: error.message });
  }
};

exports.getCandles = async (req, res) => {
  const symbol = req.query.symbol;
  const resolution = req.query.resolution || 'D';
  // Default: last 30 days
  let from = req.query.from;
  let to = req.query.to;
  const now = Math.floor(Date.now() / 1000);
  if (!from || !to) {
    // 30 days ago
    from = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    to = now;
  }
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }
  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/stock/candle`, {
      params: { symbol, resolution, from, to, token: FINNHUB_API_KEY }
    });
    const data = response.data;
    if (data.s !== 'ok') {
      return res.status(404).json({ error: 'No candlestick data found' });
    }
    // Finnhub returns arrays: t (timestamp), o (open), h (high), l (low), c (close)
    const candles = data.t.map((timestamp, i) => ({
      time: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i]
    }));
    res.json({
      symbol,
      candles
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candles', details: error.message });
  }
};
