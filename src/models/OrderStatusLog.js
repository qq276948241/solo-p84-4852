const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const { OrderStatus } = require('../constants');

class OrderStatusLog extends Model {}

OrderStatusLog.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    orderId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'order_id',
      comment: '订单ID',
    },
    fromStatus: {
      type: DataTypes.ENUM(
        OrderStatus.PENDING_PICKUP,
        OrderStatus.PICKED_UP,
        OrderStatus.WASHING,
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED
      ),
      allowNull: true,
      field: 'from_status',
      comment: '原状态',
    },
    toStatus: {
      type: DataTypes.ENUM(
        OrderStatus.PENDING_PICKUP,
        OrderStatus.PICKED_UP,
        OrderStatus.WASHING,
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED
      ),
      allowNull: false,
      field: 'to_status',
      comment: '新状态',
    },
    operatedBy: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'operated_by',
      comment: '操作人ID',
    },
    remark: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '备注',
    },
  },
  {
    sequelize,
    modelName: 'OrderStatusLog',
    tableName: 'order_status_logs',
    underscored: true,
    indexes: [
      { fields: ['order_id'] },
      { fields: ['created_at'] },
    ],
  }
);

module.exports = OrderStatusLog;
