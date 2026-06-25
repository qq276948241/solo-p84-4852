const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db/sequelize');

class VerifyCode extends Model {}

VerifyCode.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    phone: {
      type: DataTypes.STRING(11),
      allowNull: false,
      comment: '手机号',
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
      comment: '验证码',
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: '角色',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
      comment: '过期时间',
    },
    used: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      comment: '是否已使用:1-已使用,0-未使用',
    },
  },
  {
    sequelize,
    modelName: 'VerifyCode',
    tableName: 'verify_codes',
    underscored: true,
    indexes: [
      { fields: ['phone', 'role'] },
      { fields: ['expires_at'] },
    ],
  }
);

module.exports = VerifyCode;
