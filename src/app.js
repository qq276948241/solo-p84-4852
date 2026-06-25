require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { logger } = require('./utils/logger');
const { error } = require('./utils/response');
const { ErrorCode } = require('./constants');
const { testConnection, syncDB } = require('./db/sequelize');

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json(error(10000, `接口不存在: ${req.method} ${req.url}`));
});

app.use((err, req, res, next) => {
  logger.error('未捕获的异常:', err);
  res.status(500).json(error(ErrorCode.INTERNAL_ERROR, err.message));
});

async function start() {
  logger.info('服务启动中...');
  logger.info(`环境: ${config.nodeEnv}`);

  await testConnection();
  await syncDB(false);

  app.listen(config.port, () => {
    logger.info(`服务已启动: http://localhost:${config.port}`);
    logger.info('接口文档:');
    logger.info('  健康检查: GET  /health');
    logger.info('');
    logger.info('  认证相关:');
    logger.info('    POST /api/auth/send-code   发送验证码');
    logger.info('    POST /api/auth/login       登录');
    logger.info('    GET  /api/auth/me          当前用户信息');
    logger.info('');
    logger.info('  订单相关:');
    logger.info('    POST   /api/orders                顾客下单');
    logger.info('    GET    /api/orders/my             查看我的订单');
    logger.info('    GET    /api/orders/phone/:phone   按手机号查订单(店员)');
    logger.info('    GET    /api/orders/:orderId       订单详情');
    logger.info('    PATCH  /api/orders/:orderId/status  修改订单状态(店员)');
    logger.info('    GET    /api/orders                所有订单(店员)');
    logger.info('');
    logger.info('  管理员:');
    logger.info('    GET  /api/admin/today     今日统计');
    logger.info('    GET  /api/admin/status    状态统计');
    logger.info('    GET  /api/admin/range     区间统计');
    logger.info('    GET  /api/admin/duration  平均停留时长');
  });
}

start().catch((err) => {
  logger.error('服务启动失败:', err);
  process.exit(1);
});

module.exports = app;
