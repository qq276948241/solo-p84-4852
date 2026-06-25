const { success, error } = require('../utils/response');
const {
  ErrorCode,
  OrderStatus,
  OrderStatusText,
  ClothingType,
  ClothingTypeText,
} = require('../constants');
const { logger } = require('../utils/logger');
const { Order, OrderStatusLog, User } = require('../models');
const dayjs = require('dayjs');
const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const { formatOrder } = require('./orderController');

async function getTodayStats(req, res) {
  try {
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();

    const todayOrdersCount = await Order.count({
      where: {
        created_at: { [Op.between]: [todayStart, todayEnd] },
      },
    });

    const statusCounts = await Order.findAll({
      where: {
        created_at: { [Op.between]: [todayStart, todayEnd] },
      },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    });

    const statsByStatus = {};
    Object.values(OrderStatus).forEach((s) => {
      statsByStatus[s] = {
        text: OrderStatusText[s],
        count: 0,
      };
    });
    statusCounts.forEach((item) => {
      if (statsByStatus[item.status]) {
        statsByStatus[item.status].count = parseInt(item.count);
      }
    });

    const pendingCount = await Order.count({
      where: {
        status: {
          [Op.in]: [OrderStatus.PENDING_PICKUP, OrderStatus.PICKED_UP, OrderStatus.WASHING],
        },
      },
    });

    const todayCompleted = await Order.count({
      where: {
        status: OrderStatus.COMPLETED,
        completedTime: { [Op.between]: [todayStart, todayEnd] },
      },
    });

    const totalClothingToday = await Order.sum('clothing_count', {
      where: {
        created_at: { [Op.between]: [todayStart, todayEnd] },
      },
    });

    return res.json(
      success({
        date: dayjs().format('YYYY-MM-DD'),
        todayOrdersCount,
        todayCompletedCount: todayCompleted,
        todayClothingCount: totalClothingToday || 0,
        pendingOrdersCount: pendingCount,
        statusBreakdown: statsByStatus,
      })
    );
  } catch (err) {
    logger.error('获取今日统计失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '获取统计数据失败'));
  }
}

async function getStatusStats(req, res) {
  try {
    const statusCounts = await Order.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    });

    const result = {};
    Object.values(OrderStatus).forEach((s) => {
      result[s] = {
        text: OrderStatusText[s],
        count: 0,
      };
    });

    statusCounts.forEach((item) => {
      if (result[item.status]) {
        result[item.status].count = parseInt(item.count);
      }
    });

    const total = Object.values(result).reduce((sum, item) => sum + item.count, 0);

    return res.json(
      success({
        total,
        statusBreakdown: result,
      })
    );
  } catch (err) {
    logger.error('获取状态统计失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '获取统计数据失败'));
  }
}

async function getRangeStats(req, res) {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    const missing = [];
    if (!startDate) missing.push('startDate');
    if (!endDate) missing.push('endDate');
    return res.json(
      error(ErrorCode.PARAM_MISSING, `参数缺失: ${missing.join(', ')}`)
    );
  }

  const sd = new Date(startDate);
  const ed = new Date(endDate);

  if (isNaN(sd.getTime())) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'startDate格式错误'));
  }
  if (isNaN(ed.getTime())) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'endDate格式错误'));
  }
  if (sd > ed) {
    return res.json(error(ErrorCode.PARAM_INVALID, 'startDate不能大于endDate'));
  }

  try {
    const start = dayjs(sd).startOf('day').toDate();
    const end = dayjs(ed).endOf('day').toDate();

    const orders = await Order.findAll({
      where: {
        created_at: { [Op.between]: [start, end] },
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('clothing_count')), 'clothing_count'],
      ],
      group: ['date', 'status'],
      order: [['date', 'ASC']],
      raw: true,
    });

    const dailyData = {};
    const clothingTypeStats = await Order.findAll({
      where: {
        created_at: { [Op.between]: [start, end] },
      },
      attributes: [
        'clothingType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'order_count'],
        [sequelize.fn('SUM', sequelize.col('clothing_count')), 'item_count'],
      ],
      group: ['clothing_type'],
      raw: true,
    });

    let current = dayjs(start);
    const endDay = dayjs(end);
    while (current.isBefore(endDay) || current.isSame(endDay, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');
      dailyData[dateStr] = {
        date: dateStr,
        totalOrders: 0,
        totalClothing: 0,
        statusBreakdown: {},
      };
      Object.values(OrderStatus).forEach((s) => {
        dailyData[dateStr].statusBreakdown[s] = {
          text: OrderStatusText[s],
          count: 0,
        };
      });
      current = current.add(1, 'day');
    }

    orders.forEach((item) => {
      const date = item.date;
      if (dailyData[date]) {
        dailyData[date].totalOrders += parseInt(item.count);
        dailyData[date].totalClothing += parseInt(item.clothing_count) || 0;
        if (dailyData[date].statusBreakdown[item.status]) {
          dailyData[date].statusBreakdown[item.status].count = parseInt(item.count);
        }
      }
    });

    const clothingStats = {};
    Object.values(ClothingType).forEach((t) => {
      clothingStats[t] = {
        text: ClothingTypeText[t],
        orderCount: 0,
        itemCount: 0,
      };
    });
    clothingTypeStats.forEach((item) => {
      if (clothingStats[item.clothingType]) {
        clothingStats[item.clothingType].orderCount = parseInt(item.order_count);
        clothingStats[item.clothingType].itemCount = parseInt(item.item_count) || 0;
      }
    });

    return res.json(
      success({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD'),
        dailyStats: Object.values(dailyData),
        clothingTypeStats: clothingStats,
      })
    );
  } catch (err) {
    logger.error('获取区间统计失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '获取统计数据失败'));
  }
}

async function getAvgDurationStats(req, res) {
  try {
    const logs = await OrderStatusLog.findAll({
      include: [
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'orderNo'],
          where: { status: OrderStatus.COMPLETED },
          required: true,
        },
      ],
      attributes: ['orderId', 'fromStatus', 'toStatus', 'createdAt'],
      order: [['orderId', 'ASC'], ['createdAt', 'ASC']],
      raw: true,
    });

    const orderTransitions = {};
    logs.forEach((log) => {
      if (!orderTransitions[log.orderId]) {
        orderTransitions[log.orderId] = [];
      }
      orderTransitions[log.orderId].push(log);
    });

    const durationStats = {
      [OrderStatus.PENDING_PICKUP]: { text: OrderStatusText[OrderStatus.PENDING_PICKUP], totalMs: 0, count: 0 },
      [OrderStatus.PICKED_UP]: { text: OrderStatusText[OrderStatus.PICKED_UP], totalMs: 0, count: 0 },
      [OrderStatus.WASHING]: { text: OrderStatusText[OrderStatus.WASHING], totalMs: 0, count: 0 },
    };

    Object.values(orderTransitions).forEach((transitions) => {
      for (let i = 0; i < transitions.length - 1; i++) {
        const from = transitions[i];
        const to = transitions[i + 1];
        if (from.toStatus && durationStats[from.toStatus]) {
          const duration = new Date(to.createdAt) - new Date(from.createdAt);
          durationStats[from.toStatus].totalMs += duration;
          durationStats[from.toStatus].count++;
        }
      }
    });

    const result = {};
    Object.keys(durationStats).forEach((status) => {
      const stat = durationStats[status];
      const avgMs = stat.count > 0 ? stat.totalMs / stat.count : 0;
      result[status] = {
        text: stat.text,
        sampleCount: stat.count,
        avgDurationMs: Math.round(avgMs),
        avgDurationMinutes: Math.round(avgMs / 60000),
        avgDurationHours: Number((avgMs / 3600000).toFixed(2)),
      };
    });

    return res.json(success(result));
  } catch (err) {
    logger.error('获取时长统计失败:', err);
    return res.json(error(ErrorCode.DB_ERROR, '获取统计数据失败'));
  }
}

module.exports = {
  getTodayStats,
  getStatusStats,
  getRangeStats,
  getAvgDurationStats,
};
