const { success, error } = require('../utils/response');
const { ErrorCode, UserRole } = require('../constants');
const { isValidPhone, generateVerifyCode } = require('../utils/validate');
const { logVerifyCode, logger } = require('../utils/logger');
const dayjs = require('dayjs');
const config = require('../config');
const { generateToken } = require('../middleware/auth');
const { User, VerifyCode } = require('../models');
const { Op } = require('sequelize');

const validRoles = [UserRole.CUSTOMER, UserRole.STAFF, UserRole.ADMIN];

async function sendVerifyCode(req, res) {
  const { phone, role = UserRole.CUSTOMER } = req.body;

  if (!phone) {
    return res.json(error(ErrorCode.PARAM_MISSING, '参数缺失: phone'));
  }

  if (!isValidPhone(phone)) {
    return res.json(error(ErrorCode.PHONE_FORMAT_ERROR));
  }

  if (!validRoles.includes(role)) {
    return res.json(error(ErrorCode.PARAM_INVALID, '角色类型无效'));
  }

  try {
    const code = generateVerifyCode();
    const expiresAt = dayjs()
      .add(config.verifyCode.expires, 'minute')
      .toDate();

    await VerifyCode.create({
      phone,
      code,
      role,
      expiresAt,
    });

    logVerifyCode(phone, code, role, dayjs(expiresAt).format('YYYY-MM-DD HH:mm:ss'));

    return res.json(success({ sent: true }, '验证码已发送，请查看日志'));
  } catch (err) {
    logger.error('发送验证码失败:', err);
    return res.json(error(ErrorCode.VERIFY_CODE_SEND_FAILED));
  }
}

async function login(req, res) {
  const { phone, code, role = UserRole.CUSTOMER } = req.body;

  if (!phone || !code) {
    const missing = [];
    if (!phone) missing.push('phone');
    if (!code) missing.push('code');
    return res.json(error(ErrorCode.PARAM_MISSING, `参数缺失: ${missing.join(', ')}`));
  }

  if (!isValidPhone(phone)) {
    return res.json(error(ErrorCode.PHONE_FORMAT_ERROR));
  }

  if (!validRoles.includes(role)) {
    return res.json(error(ErrorCode.PARAM_INVALID, '角色类型无效'));
  }

  if (!/^\d{6}$/.test(code)) {
    return res.json(error(ErrorCode.PARAM_INVALID, '验证码格式错误，应为6位数字'));
  }

  try {
    const now = dayjs().toDate();

    const verifyCode = await VerifyCode.findOne({
      where: {
        phone,
        role,
        code,
        used: 0,
        expiresAt: { [Op.gt]: now },
      },
      order: [['created_at', 'DESC']],
    });

    if (!verifyCode) {
      const expiredCode = await VerifyCode.findOne({
        where: {
          phone,
          role,
          code,
        },
        order: [['created_at', 'DESC']],
      });

      if (expiredCode && dayjs(expiredCode.expiresAt).isBefore(now)) {
        return res.json(error(ErrorCode.VERIFY_CODE_EXPIRED));
      }

      return res.json(error(ErrorCode.VERIFY_CODE_INCORRECT));
    }

    await verifyCode.update({ used: 1 });

    let user = await User.findOne({
      where: { phone, status: 1 },
    });

    if (user && user.role !== role) {
      return res.json(error(ErrorCode.PERMISSION_DENIED, '该账号角色不匹配'));
    }

    if (!user) {
      user = await User.create({
        phone,
        role,
        nickname: role === UserRole.CUSTOMER ? `顾客${phone.slice(-4)}` : `用户${phone.slice(-4)}`,
      });
    }

    const token = generateToken(user);

    return res.json(
      success(
        {
          token,
          user: {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            role: user.role,
          },
        },
        '登录成功'
      )
    );
  } catch (err) {
    logger.error('登录失败:', err);
    return res.json(error(ErrorCode.INTERNAL_ERROR));
  }
}

async function getCurrentUser(req, res) {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'phone', 'nickname', 'role', 'created_at'],
    });

    if (!user) {
      return res.json(error(ErrorCode.DATA_NOT_FOUND, '用户不存在'));
    }

    return res.json(success(user));
  } catch (err) {
    logger.error('获取用户信息失败:', err);
    return res.json(error(ErrorCode.INTERNAL_ERROR));
  }
}

module.exports = {
  sendVerifyCode,
  login,
  getCurrentUser,
};
