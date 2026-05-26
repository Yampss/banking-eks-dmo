const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { userRateLimiter } = require('../middlewares/rateLimiter');
const { chat, clearChat, getHistory } = require('../controllers/ai.controller');

// All AI routes require a valid JWT — auth runs before rate limiter
router.use(authenticate);

// Rate limit applies after auth so we key on verified user ID
router.post('/chat',    userRateLimiter, chat);
router.delete('/chat',  clearChat);
router.get('/history',  getHistory);

module.exports = router;
