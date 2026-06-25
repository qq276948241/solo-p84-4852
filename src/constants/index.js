const ErrorCode = {
  SUCCESS: 0,

  PARAM_MISSING: 10001,
  PARAM_INVALID: 10002,
  PHONE_FORMAT_ERROR: 10003,
  TIME_CONFLICT: 10004,
  DATA_NOT_FOUND: 10005,

  VERIFY_CODE_SEND_FAILED: 20001,
  VERIFY_CODE_EXPIRED: 20002,
  VERIFY_CODE_INCORRECT: 20003,

  TOKEN_MISSING: 30001,
  TOKEN_INVALID: 30002,
  TOKEN_EXPIRED: 30003,
  PERMISSION_DENIED: 30004,

  ORDER_STATUS_TRANSITION_INVALID: 40001,
  ORDER_NOT_FOUND: 40002,
  ORDER_CANNOT_CANCEL: 40003,

  DB_ERROR: 50001,
  INTERNAL_ERROR: 50000,
};

const ErrorMessage = {
  [ErrorCode.SUCCESS]: '成功',

  [ErrorCode.PARAM_MISSING]: '参数缺失',
  [ErrorCode.PARAM_INVALID]: '参数格式错误',
  [ErrorCode.PHONE_FORMAT_ERROR]: '手机号格式错误',
  [ErrorCode.TIME_CONFLICT]: '时间冲突，请选择其他时间段',
  [ErrorCode.DATA_NOT_FOUND]: '数据不存在',

  [ErrorCode.VERIFY_CODE_SEND_FAILED]: '验证码发送失败',
  [ErrorCode.VERIFY_CODE_EXPIRED]: '验证码已过期',
  [ErrorCode.VERIFY_CODE_INCORRECT]: '验证码错误',

  [ErrorCode.TOKEN_MISSING]: '缺少认证token',
  [ErrorCode.TOKEN_INVALID]: 'token无效',
  [ErrorCode.TOKEN_EXPIRED]: 'token已过期',
  [ErrorCode.PERMISSION_DENIED]: '无权限操作',

  [ErrorCode.ORDER_STATUS_TRANSITION_INVALID]: '订单状态流转不合法',
  [ErrorCode.ORDER_NOT_FOUND]: '订单不存在',
  [ErrorCode.ORDER_CANNOT_CANCEL]: '当前状态不允许取消订单',

  [ErrorCode.DB_ERROR]: '数据库操作失败',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
};

const OrderStatus = {
  PENDING_PICKUP: 'pending_pickup',
  PICKED_UP: 'picked_up',
  WASHING: 'washing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const OrderStatusText = {
  [OrderStatus.PENDING_PICKUP]: '待取件',
  [OrderStatus.PICKED_UP]: '已取走',
  [OrderStatus.WASHING]: '清洗中',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
};

const UserRole = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  ADMIN: 'admin',
};

const ClothingType = {
  SHIRT: 'shirt',
  TROUSERS: 'trousers',
  COAT: 'coat',
  DRESS: 'dress',
  SUIT: 'suit',
  BEDDING: 'bedding',
  OTHER: 'other',
};

const ClothingTypeText = {
  [ClothingType.SHIRT]: '衬衫',
  [ClothingType.TROUSERS]: '裤子',
  [ClothingType.COAT]: '外套',
  [ClothingType.DRESS]: '连衣裙',
  [ClothingType.SUIT]: '西装',
  [ClothingType.BEDDING]: '床上用品',
  [ClothingType.OTHER]: '其他',
};

const StatusTransitionRules = {
  [OrderStatus.PENDING_PICKUP]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [OrderStatus.WASHING, OrderStatus.CANCELLED],
  [OrderStatus.WASHING]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

module.exports = {
  ErrorCode,
  ErrorMessage,
  OrderStatus,
  OrderStatusText,
  UserRole,
  ClothingType,
  ClothingTypeText,
  StatusTransitionRules,
};
