const { ClothingType, ClothingTypeText } = require('../constants');

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

function getUnitPrice(clothingType) {
  const price = PRICE_MAP[clothingType];
  return typeof price === 'number' ? price : DEFAULT_UNIT_PRICE;
}

function calculatePrice(clothingType, clothingCount) {
  const unitPrice = getUnitPrice(clothingType);
  const count = Number.isInteger(clothingCount) && clothingCount > 0 ? clothingCount : 0;
  return unitPrice * count;
}

function isValidClothingType(clothingType) {
  return Object.prototype.hasOwnProperty.call(PRICE_MAP, clothingType);
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
  getUnitPrice,
  calculatePrice,
  isValidClothingType,
  getValidClothingTypes,
  getValidClothingTypeText,
};
