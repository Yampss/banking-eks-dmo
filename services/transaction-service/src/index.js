require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./models/transaction.model');
const transactionRoutes = require('./routes/transaction.routes');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'transaction-service' });
});

app.use('/api/transactions', transactionRoutes);

const start = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Transaction service running on port ${PORT}`);
  });
};

start();
