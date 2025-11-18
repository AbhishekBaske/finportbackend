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
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch price', details: error.message });
  }
};

exports.getCandles = async (req, res) => {
  const symbol = req.query.symbol;
  const resolution = req.query.resolution || 'D';
  const from = req.query.from;
  const to = req.query.to;
  if (!symbol || !from || !to) {
    return res.status(400).json({ error: 'Symbol, from, and to are required' });
  }
  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/stock/candle`, {
      params: { symbol, resolution, from, to, token: FINNHUB_API_KEY }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candles', details: error.message });
  }
};
