const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');

const log = (event, extra = {}) =>
  console.log(JSON.stringify({ event, service: 'ai-service', ts: new Date().toISOString(), ...extra }));

// ─── Redis client (ElastiCache) ───────────────────────────────────────────────
// REDIS_HOST is set by bootstrap.sh from Secrets Manager / SSM at boot time.
// Falls back to localhost only for local dev.
const redisClient = createClient({
  socket: {
    host:           process.env.REDIS_HOST || 'localhost',
    port:           parseInt(process.env.REDIS_PORT || '6379'),
    connectTimeout: 5000,
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Redis reconnect limit reached');
      return Math.min(retries * 200, 3000);
    },
  },
});

redisClient.on('error', (err) =>
  log('redis_error', { message: err.message })
);
redisClient.on('connect', () => log('redis_connected'));
redisClient.on('reconnecting', () => log('redis_reconnecting'));

// Connect immediately — errors are logged, not thrown (service still boots)
redisClient.connect().catch((err) =>
  log('redis_connect_failed', { message: err.message })
);

// ─── Per-user rate limiter ─────────────────────────────────────────────────
// Keyed on verified JWT user ID (not IP — easily spoofed).
// All ASG instances share the same ElastiCache Redis — counters are global.
// 20 req/min per user = ~$0.001/day at Claude Haiku pricing.
const userRateLimiter = rateLimit({
  windowMs:       60 * 1000,
  max:            20,
  standardHeaders: true,
  legacyHeaders:  false,

  // Distributed Redis store — works across all ASG instances
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:ai:',
  }),

  // Key by user ID from JWT (set by auth middleware before this runs)
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : req.ip,

  handler: (req, res) => {
    log('rate_limit_exceeded', { userId: req.user?.id || null });
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please wait a moment before sending another message.',
    });
  },

  // If Redis is unavailable, fall back to in-memory (fail-open with warning)
  skip: (req) => {
    if (!redisClient.isReady) {
      log('rate_limit_redis_unavailable', { userId: req.user?.id });
      return false; // still rate-limit but using in-memory fallback
    }
    return false;
  },
});

module.exports = { userRateLimiter, redisClient };
