require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./models/user.model');
const userRoutes = require('./routes/user.routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'user-service' });
});

app.use('/api/users', userRoutes);

app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`User service running on port ${PORT}`);
  });
};

start();
