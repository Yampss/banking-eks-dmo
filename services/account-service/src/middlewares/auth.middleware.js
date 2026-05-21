const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'banking_jwt_secret_key';

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const internalOnly = (req, res, next) => {
  const internalKey = req.headers['x-internal-key'];
  if (internalKey !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ success: false, message: 'Internal access only' });
  }
  next();
};

module.exports = { authenticate, authorizeAdmin, internalOnly };
