const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

const generateAccountNumber = () => {
  const ts = Date.now().toString();
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return ts.slice(-8) + rand;
};

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      account_number VARCHAR(20) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      account_type VARCHAR(20) NOT NULL DEFAULT 'savings',
      balance DECIMAL(15,2) DEFAULT 0.00,
      currency VARCHAR(5) DEFAULT 'USD',
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const create = async ({ user_id, account_type, currency }) => {
  const account_number = generateAccountNumber();
  const result = await pool.query(
    `INSERT INTO accounts (account_number, user_id, account_type, currency)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [account_number, user_id, account_type || 'savings', currency || 'USD']
  );
  return result.rows[0];
};

const findByUserId = async (user_id) => {
  const result = await pool.query(
    'SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC',
    [user_id]
  );
  return result.rows;
};

const findById = async (id) => {
  const result = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
  return result.rows[0];
};

const findByAccountNumber = async (account_number) => {
  const result = await pool.query('SELECT * FROM accounts WHERE account_number = $1', [account_number]);
  return result.rows[0];
};

const updateBalance = async (id, amount, client) => {
  const db = client || pool;
  const result = await db.query(
    `UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND status = 'active' RETURNING *`,
    [amount, id]
  );
  return result.rows[0];
};

const updateStatus = async (id, status) => {
  const result = await pool.query(
    'UPDATE accounts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [status, id]
  );
  return result.rows[0];
};

const getAll = async () => {
  const result = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
  return result.rows;
};

module.exports = { initDB, create, findByUserId, findById, findByAccountNumber, updateBalance, updateStatus, getAll, pool };
