require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./models/chat.model');
const aiRoutes = require('./routes/ai.routes');

const log = (event, extra = {}) =>
  console.log(JSON.stringify({ event, service: 'ai-service', ts: new Date().toISOString(), ...extra }));

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json({ limit: '16kb' }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-service', ts: new Date().toISOString() });
});

app.use('/api/ai', aiRoutes);

app.use((err, req, res, next) => {
  log('unhandled_error', { message: err.message, path: req.path });
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  // Retry DB init — RDS Proxy may take a moment on first connection
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await initDB();
      log('db_init_ok');
      break;
    } catch (err) {
      log('db_init_retry', { attempt, error: err.message });
      if (attempt === 5) { log('db_init_failed'); process.exit(1); }
      await new Promise(r => setTimeout(r, attempt * 3000));
    }
  }

  const server = app.listen(PORT, () => log('startup', { port: PORT }));

  const shutdown = (signal) => {
    log('shutdown_start', { signal });
    server.close(() => { log('shutdown_complete'); process.exit(0); });
    setTimeout(() => process.exit(1), 25000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

start();
