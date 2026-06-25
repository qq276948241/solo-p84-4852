const { Sequelize } = require('sequelize');
const config = require('../config');
const { logger } = require('../utils/logger');

const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    dialectOptions: {
      charset: 'utf8mb4',
    },
    timezone: '+08:00',
    pool: {
      max: 20,
      min: 5,
      idle: 10000,
      acquire: 60000,
    },
    logging: (msg) => logger.debug(msg),
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');
  } catch (err) {
    logger.error('数据库连接失败:', err);
    process.exit(1);
  }
}

async function syncDB(force = false) {
  try {
    await sequelize.sync({ force, alter: !force });
    logger.info(`数据库同步完成${force ? '(强制重建)' : ''}`);
  } catch (err) {
    logger.error('数据库同步失败:', err);
    process.exit(1);
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDB,
};
