const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'banking_jwt_secret_key';

/**
 * JWT authentication middleware.
 * Rejects unauthenticated requests with 401 before any AI processing begins.
 * The decoded payload is attached to req.user for downstream use.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    // Store the raw token so we can forward it to internal services
    req.rawToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
