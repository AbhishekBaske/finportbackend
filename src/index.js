// Entry point for backend Express server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const http = require('http').createServer(app);
const websocket = require('./websocket');

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://finport-frontend.onrender.com', 'https://finport-unbk.onrender.com', 'https://finportk.netlify.app', 'http://localhost:3000']
    : process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


// Example route
app.get('/', (req, res) => {
  res.send('Finport backend running - CORS updated for Netlify');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User OTP routes

const userRoutes = require('./routes/userRoutes');
const stockRoutes = require('./routes/stockRoutes');
app.use('/api/user', userRoutes);
app.use('/api/stock', stockRoutes);

// Attach WebSocket
websocket(http);

const PORT = process.env.PORT || 4000;
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server listening on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});
