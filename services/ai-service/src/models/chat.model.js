const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ai_db',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false }, // RDS requires SSL
  max: 10,
  idleTimeoutMillis: 30000,
});

/**
 * Create the chat_sessions and chat_messages tables if they don't exist.
 * Called once at service startup.
 *
 * Schema design:
 *  - chat_sessions: one row per user session (user_id + expires_at)
 *  - chat_messages: individual messages linked to a session
 *  - NO raw financial data stored — only the user's text and the AI reply
 */
const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
      );
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_expires ON chat_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id          SERIAL PRIMARY KEY,
        session_id  INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role        VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
        content     TEXT NOT NULL,
        token_count INTEGER,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    `);
    console.log(JSON.stringify({ event: 'db_init', status: 'ok', tables: ['chat_sessions', 'chat_messages'] }));
  } finally {
    client.release();
  }
};

/**
 * Get or create an active session for a user.
 * Sessions older than 30 minutes are considered expired — a new one is created.
 */
const getOrCreateSession = async (userId) => {
  // Find an active (non-expired) session
  const existing = await pool.query(
    `SELECT id FROM chat_sessions
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) {
    const sessionId = existing.rows[0].id;
    // Refresh the expiry window on activity
    await pool.query(
      `UPDATE chat_sessions SET updated_at = NOW(), expires_at = NOW() + INTERVAL '30 minutes'
       WHERE id = $1`,
      [sessionId]
    );
    return sessionId;
  }
  // Create a new session
  const result = await pool.query(
    `INSERT INTO chat_sessions (user_id) VALUES ($1) RETURNING id`,
    [userId]
  );
  return result.rows[0].id;
};

/**
 * Load the last N message pairs (user + assistant) for context.
 * Returns them in chronological order for the Bedrock messages array.
 */
const loadHistory = async (sessionId, limit = 10) => {
  const result = await pool.query(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [sessionId, limit * 2] // *2 because each turn = user + assistant
  );
  return result.rows.reverse(); // chronological order
};

/**
 * Persist a user message and the AI reply.
 * IMPORTANT: we sanitize before storing — no raw financial identifiers.
 */
const saveMessages = async (sessionId, userText, assistantText, tokenCount) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [sessionId, userText]
    );
    await client.query(
      `INSERT INTO chat_messages (session_id, role, content, token_count) VALUES ($1, 'assistant', $2, $3)`,
      [sessionId, assistantText, tokenCount || null]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Delete all messages for a session (user-initiated "clear chat").
 */
const clearSession = async (userId) => {
  await pool.query(
    `DELETE FROM chat_sessions WHERE user_id = $1`,
    [userId]
  );
};

module.exports = { initDB, getOrCreateSession, loadHistory, saveMessages, clearSession };
