const io = require('socket.io-client');
const socket = io('http://localhost:4000');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('getStockPrice', 'AAPL');
});

socket.on('stockPrice', (data) => {
  console.log('Received:', data);
  socket.disconnect();
});