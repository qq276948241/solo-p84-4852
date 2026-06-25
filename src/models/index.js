const User = require('./User');
const Order = require('./Order');
const OrderStatusLog = require('./OrderStatusLog');
const VerifyCode = require('./VerifyCode');

User.hasMany(Order, {
  foreignKey: 'customer_id',
  as: 'orders',
});
Order.belongsTo(User, {
  foreignKey: 'customer_id',
  as: 'customer',
});

User.hasMany(Order, {
  foreignKey: 'handled_by',
  as: 'handledOrders',
});
Order.belongsTo(User, {
  foreignKey: 'handled_by',
  as: 'handler',
});

Order.hasMany(OrderStatusLog, {
  foreignKey: 'order_id',
  as: 'statusLogs',
});
OrderStatusLog.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order',
});

module.exports = {
  User,
  Order,
  OrderStatusLog,
  VerifyCode,
};
