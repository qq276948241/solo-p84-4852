const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const { OrderStatus } = require('../constants');

class Order extends Model {}

Order.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    orderNo: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: 'order_no',
      comment: '订单号',
    },
    customerId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'customer_id',
      comment: '顾客ID',
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '取件地址',
    },
    clothingType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'clothing_type',
      comment: '衣服类型',
    },
    clothingCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'clothing_count',
      comment: '件数',
    },
    remark: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '备注',
    },
    expectedPickupTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expected_pickup_time',
      comment: '期望取件时间',
    },
    actualPickupTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'actual_pickup_time',
      comment: '实际取件时间',
    },
    completedTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_time',
      comment: '完成时间',
    },
    status: {
      type: DataTypes.ENUM(
        OrderStatus.PENDING_PICKUP,
        OrderStatus.PICKED_UP,
        OrderStatus.WASHING,
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED
      ),
      allowNull: false,
      defaultValue: OrderStatus.PENDING_PICKUP,
      comment: '订单状态',
    },
    handledBy: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'handled_by',
      comment: '处理店员ID',
    },
    cancelReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'cancel_reason',
      comment: '取消原因',
    },
  },
  {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    underscored: true,
    indexes: [
      { unique: true, fields: ['order_no'] },
      { fields: ['customer_id'] },
      { fields: ['status'] },
      { fields: ['expected_pickup_time'] },
      { fields: ['created_at'] },
    ],
  }
);

module.exports = Order;
