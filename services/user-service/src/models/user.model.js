const pool = require('../db');

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      date_of_birth DATE,
      kyc_status VARCHAR(20) DEFAULT 'pending',
      role VARCHAR(20) DEFAULT 'customer',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const findByEmail = async (email) => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
};

const findById = async (id) => {
  const result = await pool.query(
    'SELECT id, first_name, last_name, email, phone, address, date_of_birth, kyc_status, role, is_active, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

const create = async ({ first_name, last_name, email, password_hash, phone, address, date_of_birth }) => {
  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, phone, address, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, first_name, last_name, email, phone, role, created_at`,
    [first_name, last_name, email, password_hash, phone || null, address || null, date_of_birth || null]
  );
  return result.rows[0];
};

const update = async (id, { first_name, last_name, phone, address }) => {
  const result = await pool.query(
    `UPDATE users SET first_name=$1, last_name=$2, phone=$3, address=$4, updated_at=CURRENT_TIMESTAMP
     WHERE id=$5 RETURNING id, first_name, last_name, email, phone, address, role`,
    [first_name, last_name, phone || null, address || null, id]
  );
  return result.rows[0];
};

const getAll = async () => {
  const result = await pool.query(
    'SELECT id, first_name, last_name, email, phone, kyc_status, role, is_active, created_at FROM users ORDER BY created_at DESC'
  );
  return result.rows;
};

module.exports = { initDB, findByEmail, findById, create, update, getAll };
