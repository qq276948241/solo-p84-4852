const { success, error } = require('../utils/response');
const {
  ErrorCode,
  OrderStatus,
  OrderStatusText,
  StatusTransitionRules,
  ClothingType,
  ClothingTypeText,
  UserRole,
} = require('../constants');
const { logger } = require('../utils/logger');
const { sequelize } = require('../db/sequelize');
const { Order, OrderStatusLog, User } = require('../models');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { calculatePrice, getUnitPrice, normalizeClothingType } = require('../utils/price');

function generateOrderNo() {
  const now = Date.now();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LY${now}${rand}`;
}

function formatOrder(order) {
  const result = {
    id: order.id,
    orderNo: order.orderNo,
    customerId: order.customerId,
    address: order.address,
    clothingType: order.clothingType,
    clothingTypeText: ClothingTypeText[order.clothingType] || order.clothingType,
    clothingCount: order.clothingCount,
    unitPrice: getUnitPrice(order.clothingType),
    price: parseFloat(order.price) || 0,
    remark: order.remark,
    expectedPickupTime: order.expectedPickupTime
      ? dayjs(order.expectedPickupTime).format('YYYY-MM-DD HH:mm:ss')
      : null,
    actualPickupTime: order.actualPickupTime
      ? dayjs(order.actualPickupTime).format('YYYY-MM-DD HH:mm:ss')
      : null,
    completedTime: order.completedTime
      ? dayjs(order.completedTime).format('YYYY-MM-DD HH:mm:ss')
      : null,
    status: order.status,
    statusText: OrderStatusText[order.status] || order.status,
    cancelReason: order.cancelReason,
    handledBy: order.handledBy,
    createdAt: order.createdAt
      ? dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')
      : null,
    updatedAt: order.updatedAt
      ? dayjs(order.updatedAt).format('YYYY-MM-DD HH:mm:ss')
      : null,
  };

  if (order.customer) {
    result.customer = {
      id: order.customer.id,
      phone: order.customer.phone,
      nickname: order.customer.nickname,
    };
  }

  if (order.handler) {
    result.handler = {
      id: order.handler.id,
      phone: order.handler.phone,
      nickname: order.handler.nickname,
    };
  }

  if (order.statusLogs) {
    result.statusLogs = order.statusLogs.map((log) => ({
      id: log.id,
      fromStatus: log.fromStatus,
      fromStatusText: log.fromStatus ? OrderStatusText[log.fromStatus] : null,
      toStatus: log.toStatus,
      toStatusText: OrderStatusText[log.toStatus] || log.toStatus,
      operatedBy: log.operatedBy,
      remark: log.remark,
      createdAt: log.createdAt
        ? dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')
        : null,
    }));
  }

  return result;
}

async function createOrder(req, res) {
  const { address, clothingType, clothingCount, expectedPickupTime, remark } = req.body;
  const customerId = req.user.userId;

  const missingFields = [];
  if (!address) missingFields.push('address');
  if (clothingType === undefined || clothingType === null || clothingType === '') missingFields.push('clothingType');
  if (clothingCount === undefined || clothingCount === null) missingFields.push('clothingCount');
  if (!expectedPickupTime) missingFields.push('expectedPickupTime');

  if (missingFields.length > 0) {
    return res.json(
      error(ErrorCode.PARAM_MISSING, `参数缺失: ${missingFields.join(', ')}`)
    );
  }

  const priceResult = calculatePrice(clothingType, clothingCount);
  if (!priceResult.ok) {
    return res.json(error(priceResult.code, priceResult.message));
  }

  const pickupDate = new Date(expectedPickupTime);
  if (isNaN(pickupDate.getTime())) {
    return res.json(error(ErrorCode.PARAM_INVALID, '期望取件时间格式错误'));
  }

  if (dayjs(pickupDate).isBefore(dayjs())) {
    return res.json(error(ErrorCode.PARAM_INVALID, '期望取件时间不能早于当前时间'));
  }

  try {
    const conflictOrders = await Order.count({
      where: {
        customerId,
        expectedPickupTime: {
          [Op.between]: [
            dayjs(pickupDate).subtract(1, 'hour').toDate(),
            dayjs(pickupDate).add(1, 'hour').toDate(),
          ],
        },
        status: {
          [Op.in]: [OrderStatus.PENDING_PICKUP, OrderStatus.PICKED_UP, OrderStatus.WASHING],
        },
      },
    });

    if (conflictOrders > 0) {
      return res.json(
        error(
          ErrorCode.TIME_CONFLICT,
          '该时间段已有未完成订单，请选择其他时间（前后1小时内）'
        )
      );
    }

    const result = await sequelize.transaction(async (t) => {
      const normalizedType = normalizeClothingType(clothingType);

      const order = await Order.create(
        {
          orderNo: generateOrderNo(),
          customerId,
          address,
          clothingType: normalizedType,
          clothingCount,
          price: priceResult.price,
          expectedPickupTime: pickupDate,
          remark: remark || null,
          status: OrderStatus.PENDING_PICKUP,
        },
        { transaction: t }
      );

      await OrderStatusLog.create(
        {
          orderId: order.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING_PICKUP,
          operatedBy: customerId,
          remark: '用户下单',
        },
        { transaction: t }
      );

      return order;
    });

    const orderDetail = await Order.findByPk(result.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'phone', 'nickname'] },
      ],
    });

    return res.json(success(formatOrder(orderDetail), '下单成功'));
  } catch (err) {
    logger.error('创建订单失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '创建订单失败'));
  }
}

async function updateOrderStatus(req, res) {
  const { orderId } = req.params;
  const { status, cancelReason, remark } = req.body;
  const operatorId = req.user.userId;

  if (!orderId) {
    return res.json(error(ErrorCode.PARAM_MISSING, '参数缺失: orderId'));
  }

  if (!status) {
    return res.json(error(ErrorCode.PARAM_MISSING, '参数缺失: status'));
  }

  if (!Object.values(OrderStatus).includes(status)) {
    return res.json(
      error(
        ErrorCode.PARAM_INVALID,
        `订单状态无效，可选值: ${Object.keys(OrderStatus).join(', ')}`
      )
    );
  }

  try {
    const order = await Order.findByPk(orderId, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'phone', 'nickname'] },
        { model: User, as: 'handler', attributes: ['id', 'phone', 'nickname'] },
      ],
    });

    if (!order) {
      return res.json(error(ErrorCode.ORDER_NOT_FOUND));
    }

    if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.PENDING_PICKUP) {
      if (req.user.role === UserRole.CUSTOMER) {
        return res.json(error(ErrorCode.ORDER_CANNOT_CANCEL));
      }
    }

    const allowedTransitions = StatusTransitionRules[order.status] || [];
    if (order.status !== status && !allowedTransitions.includes(status)) {
      return res.json(
        error(
          ErrorCode.ORDER_STATUS_TRANSITION_INVALID,
          `订单状态 [${OrderStatusText[order.status]}] 不能变更为 [${OrderStatusText[status]}]`
        )
      );
    }

    if (order.status === status) {
      return res.json(success(formatOrder(order), '订单状态未变化'));
    }

    const result = await sequelize.transaction(async (t) => {
      const updateData = {
        status,
        handledBy: operatorId,
      };

      if (status === OrderStatus.PICKED_UP) {
        updateData.actualPickupTime = dayjs().toDate();
      }

      if (status === OrderStatus.COMPLETED) {
        updateData.completedTime = dayjs().toDate();
      }

      if (status === OrderStatus.CANCELLED && cancelReason) {
        updateData.cancelReason = cancelReason;
      }

      await order.update(updateData, { transaction: t });

      await OrderStatusLog.create(
        {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: status,
          operatedBy: operatorId,
          remark: remark || buildDefaultRemark(status, req.user.role, cancelReason),
        },
        { transaction: t }
      );

      return order;
    });

    const updatedOrder = await Order.findByPk(result.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'phone', 'nickname'] },
        { model: User, as: 'handler', attributes: ['id', 'phone', 'nickname'] },
      ],
    });

    return res.json(success(formatOrder(updatedOrder), '状态更新成功'));
  } catch (err) {
    logger.error('更新订单状态失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '更新订单状态失败'));
  }
}

function buildDefaultRemark(status, role, cancelReason) {
  if (status === OrderStatus.PICKED_UP) return '店员取件完成';
  if (status === OrderStatus.WASHING) return '开始清洗';
  if (status === OrderStatus.COMPLETED) return '清洗完成';
  if (status === OrderStatus.CANCELLED) {
    return role === UserRole.CUSTOMER
      ? `用户取消订单${cancelReason ? ': ' + cancelReason : ''}`
      : `店员取消订单${cancelReason ? ': ' + cancelReason : ''}`;
  }
  return null;
}

async function getOrderDetail(req, res) {
  const { orderId } = req.params;

  if (!orderId) {
    return res.json(error(ErrorCode.PARAM_MISSING, '参数缺失: orderId'));
  }

  try {
    const order = await Order.findByPk(orderId, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'phone', 'nickname'] },
        { model: User, as: 'handler', attributes: ['id', 'phone', 'nickname'] },
        { model: OrderStatusLog, as: 'statusLogs', separate: true, order: [['created_at', 'ASC']] },
      ],
    });

    if (!order) {
      return res.json(error(ErrorCode.ORDER_NOT_FOUND));
    }

    if (
      req.user.role === UserRole.CUSTOMER &&
      order.customerId !== req.user.userId
    ) {
      return res.json(error(ErrorCode.PERMISSION_DENIED, '无权查看他人订单'));
    }

    return res.json(success(formatOrder(order)));
  } catch (err) {
    logger.error('获取订单详情失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '获取订单详情失败'));
  }
}

async function getMyOrders(req, res) {
  const customerId = req.user.userId;
  const { status, page = 1, pageSize = 20 } = req.query;

  const where = { customerId };

  if (status) {
    if (!Object.values(OrderStatus).includes(status)) {
      return res.json(
        error(
          ErrorCode.PARAM_INVALID,
          `订单状态无效，可选值: ${Object.keys(OrderStatus).join(', ')}`
        )
      );
    }
    where.status = status;
  }

  const p = parseInt(page);
  const ps = parseInt(pageSize);

  if (!Number.isInteger(p) || p < 1) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'page参数错误'));
  }
  if (!Number.isInteger(ps) || ps < 1 || ps > 100) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'pageSize参数错误（1-100）'));
  }

  try {
    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, as: 'customer', attributes: ['id', 'phone', 'nickname'] },
        { model: User, as: 'handler', attributes: ['id', 'phone', 'nickname'] },
      ],
      order: [['created_at', 'DESC']],
      limit: ps,
      offset: (p - 1) * ps,
    });

    return res.json(
      success({
        list: rows.map(formatOrder),
        total: count,
        page: p,
        pageSize: ps,
        totalPages: Math.ceil(count / ps),
      })
    );
  } catch (err) {
    logger.error('获取我的订单失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '获取订单列表失败'));
  }
}

async function getOrdersByPhone(req, res) {
  const { phone } = req.params;
  const { status, page = 1, pageSize = 20 } = req.query;

  if (!phone) {
    return res.json(error(ErrorCode.PARAM_MISSING, '参数缺失: phone'));
  }

  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.json(error(ErrorCode.PHONE_FORMAT_ERROR));
  }

  const p = parseInt(page);
  const ps = parseInt(pageSize);

  if (!Number.isInteger(p) || p < 1) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'page参数错误'));
  }
  if (!Number.isInteger(ps) || ps < 1 || ps > 100) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'pageSize参数错误（1-100）'));
  }

  try {
    const customer = await User.findOne({
      where: { phone, role: UserRole.CUSTOMER },
    });

    if (!customer) {
      return res.json(
        success({
          list: [],
          total: 0,
          page: p,
          pageSize: ps,
          totalPages: 0,
        })
      );
    }

    const where = { customerId: customer.id };
    if (status) {
      if (!Object.values(OrderStatus).includes(status)) {
        return res.json(
          error(
            ErrorCode.PARAM_INVALID,
            `订单状态无效，可选值: ${Object.keys(OrderStatus).join(', ')}`
          )
        );
      }
      where.status = status;
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, as: 'customer', attributes: ['id', 'phone', 'nickname'] },
        { model: User, as: 'handler', attributes: ['id', 'phone', 'nickname'] },
        { model: OrderStatusLog, as: 'statusLogs', separate: true, order: [['created_at', 'ASC']] },
      ],
      order: [['created_at', 'DESC']],
      limit: ps,
      offset: (p - 1) * ps,
    });

    return res.json(
      success({
        list: rows.map(formatOrder),
        total: count,
        page: p,
        pageSize: ps,
        totalPages: Math.ceil(count / ps),
      })
    );
  } catch (err) {
    logger.error('按手机号查询订单失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '查询订单失败'));
  }
}

async function getAllOrders(req, res) {
  const { status, phone, startDate, endDate, page = 1, pageSize = 20 } = req.query;

  const p = parseInt(page);
  const ps = parseInt(pageSize);

  if (!Number.isInteger(p) || p < 1) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'page参数错误'));
  }
  if (!Number.isInteger(ps) || ps < 1 || ps > 100) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'pageSize参数错误（1-100）'));
  }

  const where = {};

  if (status) {
    if (!Object.values(OrderStatus).includes(status)) {
      return res.json(
        error(
          ErrorCode.PARAM_INVALID,
          `订单状态无效，可选值: ${Object.keys(OrderStatus).join(', ')}`
        )
      );
    }
    where.status = status;
  }

  if (startDate) {
    const sd = new Date(startDate);
    if (isNaN(sd.getTime())) {
      return res.json(error(ErrorCode.PARAM_INVALID, 'startDate格式错误'));
    }
    where.created_at = { ...(where.created_at || {}), [Op.gte]: dayjs(sd).startOf('day').toDate() };
  }

  if (endDate) {
    const ed = new Date(endDate);
    if (isNaN(ed.getTime())) {
      return res.json(error(ErrorCode.PARAM_INVALID, 'endDate格式错误'));
    }
    where.created_at = { ...(where.created_at || {}), [Op.lte]: dayjs(ed).endOf('day').toDate() };
  }

  const include = [
    { model: User, as: 'customer', attributes: ['id', 'phone', 'nickname'] },
    { model: User, as: 'handler', attributes: ['id', 'phone', 'nickname'] },
  ];

  if (phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.json(error(ErrorCode.PHONE_FORMAT_ERROR));
    }
    include[0].where = { phone };
  }

  try {
    const { count, rows } = await Order.findAndCountAll({
      where,
      include,
      order: [['created_at', 'DESC']],
      limit: ps,
      offset: (p - 1) * ps,
    });

    return res.json(
      success({
        list: rows.map(formatOrder),
        total: count,
        page: p,
        pageSize: ps,
        totalPages: Math.ceil(count / ps),
      })
    );
  } catch (err) {
    logger.error('获取订单列表失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '获取订单列表失败'));
  }
}

module.exports = {
  createOrder,
  updateOrderStatus,
  getOrderDetail,
  getMyOrders,
  getOrdersByPhone,
  getAllOrders,
  formatOrder,
};
