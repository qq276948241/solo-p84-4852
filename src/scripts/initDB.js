require('dotenv').config();
const { testConnection, syncDB } = require('../db/sequelize');
const { User, Order, OrderStatusLog, VerifyCode } = require('../models');
const { UserRole, OrderStatus, ClothingType, ClothingPriceMap } = require('../constants');
const dayjs = require('dayjs');
const { logger } = require('../utils/logger');

async function initDB() {
  logger.info('开始初始化数据库...');

  await testConnection();
  await syncDB(true);

  logger.info('创建默认数据...');

  const admin = await User.create({
    phone: '13800000000',
    nickname: '系统管理员',
    role: UserRole.ADMIN,
  });

  const staff = await User.create({
    phone: '13800000001',
    nickname: '店员小张',
    role: UserRole.STAFF,
  });

  const customer1 = await User.create({
    phone: '13900000001',
    nickname: '顾客李阿姨',
    role: UserRole.CUSTOMER,
  });

  const customer2 = await User.create({
    phone: '13900000002',
    nickname: '顾客王先生',
    role: UserRole.CUSTOMER,
  });

  const order1 = await Order.create({
    orderNo: 'LY' + Date.now().toString().slice(-10) + '001',
    customerId: customer1.id,
    address: '阳光小区1栋302室',
    clothingType: ClothingType.SHIRT,
    clothingCount: 3,
    price: ClothingPriceMap[ClothingType.SHIRT] * 3,
    remark: '有一件衬衫上有油渍需要重点清洗',
    expectedPickupTime: dayjs().add(1, 'day').hour(10).minute(0).second(0).toDate(),
    status: OrderStatus.PENDING_PICKUP,
  });

  await OrderStatusLog.create({
    orderId: order1.id,
    fromStatus: null,
    toStatus: OrderStatus.PENDING_PICKUP,
    operatedBy: customer1.id,
    remark: '用户下单',
  });

  const order2 = await Order.create({
    orderNo: 'LY' + Date.now().toString().slice(-10) + '002',
    customerId: customer2.id,
    address: '阳光小区5栋201室',
    clothingType: ClothingType.SUIT,
    clothingCount: 1,
    price: ClothingPriceMap[ClothingType.SUIT] * 1,
    remark: '西装需要干洗',
    expectedPickupTime: dayjs().add(2, 'hour').toDate(),
    status: OrderStatus.PICKED_UP,
    handledBy: staff.id,
    actualPickupTime: dayjs().toDate(),
  });

  await OrderStatusLog.create({
    orderId: order2.id,
    fromStatus: null,
    toStatus: OrderStatus.PENDING_PICKUP,
    operatedBy: customer2.id,
    remark: '用户下单',
  });

  await OrderStatusLog.create({
    orderId: order2.id,
    fromStatus: OrderStatus.PENDING_PICKUP,
    toStatus: OrderStatus.PICKED_UP,
    operatedBy: staff.id,
    remark: '店员已取件',
  });

  const order3 = await Order.create({
    orderNo: 'LY' + Date.now().toString().slice(-10) + '003',
    customerId: customer1.id,
    address: '阳光小区1栋302室',
    clothingType: ClothingType.BEDDING,
    clothingCount: 2,
    price: ClothingPriceMap[ClothingType.BEDDING] * 2,
    remark: '被套和床单',
    expectedPickupTime: dayjs().subtract(1, 'day').toDate(),
    actualPickupTime: dayjs().subtract(1, 'day').add(1, 'hour').toDate(),
    completedTime: dayjs().subtract(1, 'hour').toDate(),
    status: OrderStatus.COMPLETED,
    handledBy: staff.id,
  });

  await OrderStatusLog.create({
    orderId: order3.id,
    fromStatus: null,
    toStatus: OrderStatus.PENDING_PICKUP,
    operatedBy: customer1.id,
    remark: '用户下单',
  });

  await OrderStatusLog.create({
    orderId: order3.id,
    fromStatus: OrderStatus.PENDING_PICKUP,
    toStatus: OrderStatus.PICKED_UP,
    operatedBy: staff.id,
    remark: '店员已取件',
  });

  await OrderStatusLog.create({
    orderId: order3.id,
    fromStatus: OrderStatus.PICKED_UP,
    toStatus: OrderStatus.WASHING,
    operatedBy: staff.id,
    remark: '开始清洗',
  });

  await OrderStatusLog.create({
    orderId: order3.id,
    fromStatus: OrderStatus.WASHING,
    toStatus: OrderStatus.COMPLETED,
    operatedBy: staff.id,
    remark: '清洗完成',
  });

  logger.info('数据库初始化完成!');
  logger.info('默认账号:');
  logger.info(`  管理员 - 手机号: ${admin.phone}`);
  logger.info(`  店员 - 手机号: ${staff.phone}`);
  logger.info(`  顾客1 - 手机号: ${customer1.phone}`);
  logger.info(`  顾客2 - 手机号: ${customer2.phone}`);
  logger.info('测试验证码固定为 123456，真实场景请查看日志输出');

  process.exit(0);
}

initDB().catch((err) => {
  logger.error('初始化数据库失败:', err);
  process.exit(1);
});
