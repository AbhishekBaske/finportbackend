const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/price', stockController.getPrice);
router.get('/candles', stockController.getCandles);

module.exports = router;
