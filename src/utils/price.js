const { ClothingType, ClothingTypeText, ErrorCode } = require('../constants');

const PRICE_MAP = {
  [ClothingType.TSHIRT]: 8,
  [ClothingType.SHIRT]: 8,
  [ClothingType.TROUSERS]: 8,
  [ClothingType.COAT]: 8,
  [ClothingType.DRESS]: 8,
  [ClothingType.TOWEL]: 15,
  [ClothingType.BEDDING]: 15,
  [ClothingType.SILK]: 25,
  [ClothingType.WOOL]: 25,
  [ClothingType.SUIT]: 25,
  [ClothingType.OTHER]: 8,
};

const DEFAULT_UNIT_PRICE = 0;

function normalizeClothingType(clothingType) {
  if (typeof clothingType !== 'string') return '';
  return clothingType.toLowerCase();
}

function getUnitPrice(clothingType) {
  const normalized = normalizeClothingType(clothingType);
  const price = PRICE_MAP[normalized];
  return typeof price === 'number' ? price : DEFAULT_UNIT_PRICE;
}

function calculatePrice(clothingType, clothingCount) {
  const normalized = normalizeClothingType(clothingType);
  const unitPrice = PRICE_MAP[normalized];
  if (typeof unitPrice !== 'number') {
    return { ok: false, code: ErrorCode.PARAM_INVALID, message: `衣服类型无效: ${clothingType}` };
  }
  if (!Number.isInteger(clothingCount) || clothingCount <= 0) {
    return { ok: false, code: ErrorCode.PARAM_INVALID, message: '件数必须为正整数' };
  }
  if (clothingCount > 100) {
    return { ok: false, code: ErrorCode.PARAM_INVALID, message: '件数不能超过100' };
  }
  return { ok: true, price: unitPrice * clothingCount };
}

function isValidClothingType(clothingType) {
  const normalized = normalizeClothingType(clothingType);
  return Object.prototype.hasOwnProperty.call(PRICE_MAP, normalized);
}

function getValidClothingTypes() {
  return Object.keys(PRICE_MAP);
}

function getValidClothingTypeText() {
  return getValidClothingTypes()
    .map((t) => `${t}(${ClothingTypeText[t] || t})`)
    .join(', ');
}

module.exports = {
  PRICE_MAP,
  DEFAULT_UNIT_PRICE,
  normalizeClothingType,
  getUnitPrice,
  calculatePrice,
  isValidClothingType,
  getValidClothingTypes,
  getValidClothingTypeText,
};
