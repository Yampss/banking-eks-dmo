const pool = require('../db');

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      reference_id VARCHAR(50) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      from_account_id INTEGER,
      to_account_id INTEGER,
      type VARCHAR(30) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      currency VARCHAR(5) DEFAULT 'USD',
      status VARCHAR(20) DEFAULT 'pending',
      description TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const generateRef = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `TXN-${ts}-${rand}`;
};

const create = async ({ user_id, from_account_id, to_account_id, type, amount, currency, description, metadata }) => {
  const reference_id = generateRef();
  const result = await pool.query(
    `INSERT INTO transactions (reference_id, user_id, from_account_id, to_account_id, type, amount, currency, description, metadata, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed') RETURNING *`,
    [reference_id, user_id, from_account_id, to_account_id, type, amount, currency || 'USD', description, metadata ? JSON.stringify(metadata) : '{}']
  );
  return result.rows[0];
};

const findByUserId = async (user_id, limit = 50, offset = 0) => {
  const result = await pool.query(
    `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [user_id, limit, offset]
  );
  return result.rows;
};

const findByAccountId = async (account_id, limit = 50, offset = 0) => {
  const result = await pool.query(
    `SELECT * FROM transactions WHERE from_account_id = $1 OR to_account_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [account_id, limit, offset]
  );
  return result.rows;
};

const findById = async (id) => {
  const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
  return result.rows[0];
};

const findByReference = async (reference_id) => {
  const result = await pool.query('SELECT * FROM transactions WHERE reference_id = $1', [reference_id]);
  return result.rows[0];
};

const getAll = async (limit = 100, offset = 0) => {
  const result = await pool.query(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
};

module.exports = { initDB, create, findByUserId, findByAccountId, findById, findByReference, getAll };
