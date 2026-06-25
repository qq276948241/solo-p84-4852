const { ErrorCode, ErrorMessage } = require('../constants');

function success(data, message = '成功') {
  return {
    code: ErrorCode.SUCCESS,
    message,
    data,
  };
}

function error(code, message) {
  return {
    code,
    message: message || ErrorMessage[code] || '未知错误',
    data: null,
  };
}

module.exports = {
  success,
  error,
};
