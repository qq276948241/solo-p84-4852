const { ErrorCode } = require('../constants');
const {
  isValidClothingType: priceIsValidClothingType,
  getValidClothingTypeText,
} = require('./price');

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

function isValidClothingType(clothingType) {
  return priceIsValidClothingType(clothingType);
}

function getValidClothingTypeErrorMessage() {
  return `衣服类型无效，可选值: ${getValidClothingTypeText()}`;
}

module.exports = {
  isValidPhone,
  generateVerifyCode,
  buildParamError,
  isValidClothingType,
  getValidClothingTypeErrorMessage,
};
