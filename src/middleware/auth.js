const jwt = require('jsonwebtoken');
const config = require('../config');
const { error } = require('../utils/response');
const { ErrorCode, UserRole } = require('../constants');
const { logger } = require('../utils/logger');

function generateToken(user) {
  const payload = {
    userId: user.id,
    phone: user.phone,
    role: user.role,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw { code: ErrorCode.TOKEN_EXPIRED };
    }
    throw { code: ErrorCode.TOKEN_INVALID };
  }
}

function auth() {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.json(error(ErrorCode.TOKEN_MISSING));
    }

    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      next();
    } catch (err) {
      logger.error('Token验证失败:', err);
      return res.json(error(err.code || ErrorCode.TOKEN_INVALID));
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.json(error(ErrorCode.TOKEN_MISSING));
    }

    if (!roles.includes(req.user.role)) {
      return res.json(error(ErrorCode.PERMISSION_DENIED));
    }

    next();
  };
}

const authCustomer = requireRole(UserRole.CUSTOMER);
const authStaff = requireRole(UserRole.STAFF, UserRole.ADMIN);
const authAdmin = requireRole(UserRole.ADMIN);

module.exports = {
  generateToken,
  verifyToken,
  auth,
  requireRole,
  authCustomer,
  authStaff,
  authAdmin,
};
