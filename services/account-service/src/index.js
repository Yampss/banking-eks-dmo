require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./models/account.model');
const accountRoutes = require('./routes/account.routes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'account-service' });
});

app.use('/api/accounts', accountRoutes);

const start = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Account service running on port ${PORT}`);
  });
};

start();
