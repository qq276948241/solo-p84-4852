const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const { UserRole } = require('../constants');

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    phone: {
      type: DataTypes.STRING(11),
      allowNull: false,
      unique: true,
      comment: '手机号',
    },
    nickname: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '昵称',
    },
    role: {
      type: DataTypes.ENUM(UserRole.CUSTOMER, UserRole.STAFF, UserRole.ADMIN),
      allowNull: false,
      defaultValue: UserRole.CUSTOMER,
      comment: '角色',
    },
    status: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
      comment: '状态:1-正常,0-禁用',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['phone'] },
      { fields: ['role'] },
    ],
  }
);

module.exports = User;
