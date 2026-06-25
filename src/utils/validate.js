const { ErrorCode } = require('../constants');

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildParamError(fields) {
  return {
    code: ErrorCode.PARAM_MISSING,
    message: `参数缺失: ${fields.join(', ')}`,
  };
}

module.exports = {
  isValidPhone,
  generateVerifyCode,
  buildParamError,
};
