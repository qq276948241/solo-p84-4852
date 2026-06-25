# 项目架构文档

## 一、项目简介

这是一个**小区洗衣店接单系统的后端 API 服务**，面向小区周边的小型洗衣店使用。

- **业务规模**：每天 30 ~ 50 单，属于轻量级系统
- **核心用户**：顾客（小区住户）、店员（洗衣店员工）、管理员（老板）
- **技术栈**：Node.js + Express + Sequelize (MySQL) + JWT
- **设计目标**：简单、够用、好维护，一个新人看这份文档就能接手

---

## 二、用户登录流程

系统三种角色都用**手机号 + 验证码**登录，不设密码。验证码不用真发短信，直接写日志里，方便开发测试。

### 2.1 流程图

```
  用户前端                         后端
    |                                |
    |  1. POST /api/auth/send-code   |
    |  { phone, role }               |
    | ---------------------------->  |  生成6位随机验证码
    |                                |  存 verify_codes 表
    |                                |  写日志：[验证码] 手机号:xxx, 验证码:123456
    |  { sent: true }                |
    | <----------------------------  |
    |                                |
    |  2. POST /api/auth/login       |
    |  { phone, code, role }         |
    | ---------------------------->  |  查 verify_codes 表校验
    |                                |  - 手机号+角色+验证码匹配？
    |                                |  - 没过期？（默认5分钟）
    |                                |  - 没用过？
    |                                |
    |                                |  查 users 表
    |                                |  - 首次登录自动建用户
    |                                |  - 角色必须匹配
    |                                |
    |                                |  签发 JWT (含 userId, phone, role)
    |  { token, user }               |
    | <----------------------------  |
    |                                |
    |  3. 后续请求带上               |
    |  Authorization: Bearer <token> |
    | ---------------------------->  |  中间件校验 token 有效性 + 角色权限
```

### 2.2 验证码实现细节

- 验证码是 6 位数字，随机生成
- 有效期默认 5 分钟，可在 `.env` 里改 `VERIFY_CODE_EXPIRES`
- 每个验证码只能用一次，用过后 `used` 字段置 1
- 发送验证码接口：`POST /api/auth/send-code`，测试时直接看控制台日志取验证码

### 2.3 JWT 实现细节

- Token 放在 Header 里：`Authorization: Bearer <token>`
- Token 里存了 3 个字段：`userId`、`phone`、`role`
- 中间件 `auth()` 解析 token 后挂到 `req.user` 上，后面的控制器直接用
- 权限中间件 `authCustomer` / `authStaff` / `authAdmin` 检查角色，角色不对直接返回 30004 无权限

---

## 三、订单流程

### 3.1 顾客下单

**接口**：`POST /api/orders` （顾客角色才能调用）

**下单参数**：
```json
{
  "address": "阳光小区1栋302室",
  "clothingType": "shirt",
  "clothingCount": 3,
  "expectedPickupTime": "2024-01-15 10:00:00",
  "remark": "有一件衬衫有油渍"
}
```

**下单时做了啥**：
1. 校验必填参数、衣服类型是否合法、件数是不是正整数
2. 取件时间不能早于当前时间
3. **时间冲突检测**：同一位顾客前后 1 小时内不能有两笔未完成订单（避免取件冲突）
4. **自动算价**：根据 `clothingType` 从价格表取单价 × 件数 = 总价
5. 订单创建后自动写一条状态日志（null → pending_pickup）

**衣服价格表**（在 `src/utils/price.js` 统一维护）：

| 档位 | 类型 | 单价 |
|------|------|------|
| 普通 | tshirt / shirt / trousers / coat / dress / other | 8 元/件 |
| 大件 | towel / bedding | 15 元/件 |
| 娇贵 | silk / wool / suit | 25 元/件 |

> 加新类型或调价，只改 `PRICE_MAP` 一个地方，校验和算价自动同步。

### 3.2 订单状态流转

订单一共 5 种状态，状态流转有严格规则，不是随便改的：

```
             ┌───────────────────┐
             │  pending_pickup   │ ◀── 顾客下单后的初始状态
             │   （待取件）       │
             └─────────┬─────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
   ┌───────────────┐       ┌───────────────┐
   │   picked_up   │       │   cancelled   │
   │  （已取走）     │       │  （已取消）    │
   └───────┬───────┘       └───────────────┘
           │
   ┌───────▼───────┐
   │    washing    │ ◀── 清洗中
   │  （清洗中）    │
   └───────┬───────┘
           │
   ┌───────▼───────┐
   │   completed   │ ◀── 终态，清洗完成
   │  （已完成）    │
   └───────────────┘
```

**流转规则**（在 `constants/index.js` 里的 `StatusTransitionRules`）：
- `pending_pickup` → `picked_up` / `cancelled`
- `picked_up` → `washing` / `cancelled`
- `washing` → `completed`
- `completed` / `cancelled` 是终态，不能再改

> 顾客只能取消待取件的订单，店员可以在待取件和已取走两个阶段取消。

### 3.3 OrderStatusLog 表是干嘛的？

`order_status_logs` 是**订单状态变更审计表**，每次改状态都会写一条记录，核心字段：

| 字段 | 作用 |
|------|------|
| `order_id` | 关联订单 |
| `from_status` | 原状态（创建订单时是 null） |
| `to_status` | 新状态 |
| `operated_by` | 操作人 ID |
| `remark` | 操作备注 |
| `created_at` | **变更时间戳** |

这张表有两个用处：

1. **看每个状态停留了多久**：把同一个订单的日志按时间排序，相邻两条的 `created_at` 相减，就是上一个状态停留了多长时间。
2. **追溯谁改的**：每个操作都留痕，出了问题能查到是谁在什么时候改的。

**举个例子**：某订单的 statusLogs 长这样：
```json
[
  { "fromStatus": null, "toStatus": "pending_pickup", "createdAt": "2024-01-15 09:00:00" },
  { "fromStatus": "pending_pickup", "toStatus": "picked_up", "createdAt": "2024-01-15 10:05:00" },
  { "fromStatus": "picked_up", "toStatus": "washing", "createdAt": "2024-01-15 11:30:00" },
  { "fromStatus": "washing", "toStatus": "completed", "createdAt": "2024-01-15 14:00:00" }
]
```
就能算出：
- 待取件停留了 1 小时 5 分钟
- 已取走停留了 1 小时 25 分钟
- 清洗中停留了 2 小时 30 分钟

管理员接口 `/api/admin/duration` 会自动统计所有已完成订单的平均停留时长，看哪个环节效率低。

### 3.4 店员改状态

**接口**：`PATCH /api/orders/:orderId/status` （店员/管理员才能调用）

```json
{
  "status": "picked_up",
  "cancelReason": "用户临时取消",
  "remark": "已打电话确认"
}
```

改状态时会自动：
1. 检查当前状态能不能转成目标状态（按上面的流转规则）
2. 状态从 `pending_pickup` 变 `picked_up` 时，自动填 `actualPickupTime`
3. 状态变 `completed` 时，自动填 `completedTime`
4. 给 `order_status_logs` 写一条记录

### 3.5 订单查询

| 接口 | 谁能用 | 说明 |
|------|--------|------|
| `GET /api/orders/my` | 顾客 | 看自己的订单，支持按状态筛选、分页 |
| `GET /api/orders/phone/:phone` | 店员 | 按顾客手机号查订单 |
| `GET /api/orders/:orderId` | 所有人 | 订单详情（含完整状态日志），顾客只能看自己的 |
| `GET /api/orders` | 店员 | 所有订单，支持按手机号、状态、日期范围筛选 |

---

## 四、管理员功能

管理员是老板角色，主要看经营数据，接口都在 `/api/admin` 下，只有 `admin` 角色能调。

### 4.1 今日统计 `GET /api/admin/today`

看当天营业情况，返回：
```json
{
  "date": "2024-01-15",
  "todayOrdersCount": 42,        // 今天新增订单数
  "todayCompletedCount": 28,     // 今天完成的订单数
  "todayClothingCount": 156,     // 今天总件数
  "pendingOrdersCount": 14,      // 待处理订单数（待取件+已取走+清洗中）
  "statusBreakdown": {           // 今天订单按状态分布
    "pending_pickup": { "text": "待取件", "count": 8 },
    "picked_up": { "text": "已取走", "count": 4 },
    "washing": { "text": "清洗中", "count": 2 },
    "completed": { "text": "已完成", "count": 28 },
    "cancelled": { "text": "已取消", "count": 0 }
  }
}
```

### 4.2 全局状态统计 `GET /api/admin/status`

看当前所有订单（不只是今天）的状态分布。

### 4.3 区间统计 `GET /api/admin/range?startDate=xxx&endDate=xxx`

按天看任意时间段的经营数据，包括：
- 每天的订单数、总件数、各状态分布
- 按衣服类型的订单数和件数统计

### 4.4 平均停留时长 `GET /api/admin/duration`

分析每个状态平均停留多久，返回毫秒、分钟、小时三种单位。
比如"清洗中平均耗时 2.5 小时"，老板就能知道是不是清洗环节效率低。

---

## 五、错误码

所有接口统一返回格式：
```json
{ "code": 0, "message": "成功", "data": {} }
```

`code = 0` 成功，非 0 失败。常用错误码：

| code | 含义 |
|------|------|
| 10001 | 参数缺失，message 里会告诉你缺了啥字段 |
| 10002 | 参数格式错误，比如件数传了 -1 |
| 10003 | 手机号格式错 |
| 10004 | 时间冲突，取件时间跟别的订单撞了 |
| 20002 | 验证码过期了 |
| 20003 | 验证码错了 |
| 30001 | 没传 token |
| 30004 | 无权限，比如顾客调用店员接口 |
| 40001 | 订单状态流转不合法，比如已完成的订单想改回清洗中 |
| 40002 | 订单不存在 |

---

## 六、项目目录结构

```
project84/
├── .env                      # 环境变量（数据库地址、JWT密钥等）
├── package.json              # 依赖配置
├── README.md                 # 使用文档（启动、接口清单）
├── docs/
│   └── ARCHITECTURE.md       # 本文档
├── logs/                     # 日志目录（自动生成）
│   ├── combined.log          # 所有日志
│   └── error.log             # 只存错误
└── src/
    ├── app.js                # ★ 入口文件，启动服务、挂路由
    ├── config/
    │   └── index.js          # 读取 .env，导出配置对象
    ├── constants/
    │   └── index.js          # 常量：错误码、订单状态、角色、衣服类型枚举
    ├── db/
    │   └── sequelize.js      # Sequelize 连接初始化
    ├── middleware/
    │   └── auth.js           # JWT 认证中间件 + 角色权限校验
    ├── models/               # 数据模型
    │   ├── index.js          # 模型关联关系定义
    │   ├── User.js           # 用户表（顾客/店员/管理员）
    │   ├── Order.js          # 订单表
    │   ├── OrderStatusLog.js # 订单状态变更日志表
    │   └── VerifyCode.js     # 验证码表
    ├── controllers/          # 业务逻辑
    │   ├── authController.js # 登录、发验证码
    │   ├── orderController.js# 下单、改状态、查订单
    │   └── adminController.js# 今日统计、状态统计、时长统计
    ├── routes/               # 路由
    │   ├── authRoutes.js     # /api/auth/*
    │   ├── orderRoutes.js    # /api/orders/*
    │   └── adminRoutes.js    # /api/admin/*
    ├── utils/                # 工具函数
    │   ├── response.js       # 统一响应格式 success() / error()
    │   ├── logger.js         # Winston 日志，logVerifyCode() 写验证码日志
    │   ├── validate.js       # 手机号校验、衣服类型校验
    │   └── price.js          # ★ 价格表 + 价格计算 + 类型校验（唯一真相源）
    └── scripts/
        └── initDB.js         # 初始化数据库脚本，建表 + 测试数据
```

### 关键文件说明

| 文件 | 重要性 | 改它要注意什么 |
|------|--------|----------------|
| [price.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo84/project84/src/utils/price.js) | ⭐⭐⭐ | 价格表唯一真相源，加新衣服类型只改 `PRICE_MAP`，校验和算价自动同步 |
| [constants/index.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo84/project84/src/constants/index.js) | ⭐⭐ | 状态流转规则 `StatusTransitionRules` 在这，改状态流转只改这 |
| [auth.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo84/project84/src/middleware/auth.js) | ⭐⭐ | JWT 认证逻辑在这 |
| [orderController.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo84/project84/src/controllers/orderController.js) | ⭐⭐⭐ | 核心订单逻辑，下单和改状态都在这 |

---

## 七、新人快速上手

### 1. 安装依赖
```bash
npm install
```

### 2. 改数据库配置
编辑 `.env`，把数据库地址账号密码改成你的。

### 3. 初始化数据库（建表 + 测试数据）
```bash
npm run init-db
```
会自动建 4 张表，并创建测试账号：
- 管理员 `13800000000`
- 店员 `13800000001`
- 顾客 `13900000001` / `13900000002`

### 4. 启动服务
```bash
npm start
```
服务跑在 `http://localhost:3000`

### 5. 测试接口

**登录测试**（顾客身份）：
1. 发验证码：`POST /api/auth/send-code` body `{ "phone": "13900000001", "role": "customer" }`
2. 看控制台日志，复制验证码
3. 登录：`POST /api/auth/login` body `{ "phone": "13900000001", "code": "123456", "role": "customer" }`
4. 拿到 token，后续接口 Header 里带 `Authorization: Bearer <token>`

**下单测试**（用上面拿到的顾客 token）：
```
POST /api/orders
{
  "address": "测试地址",
  "clothingType": "shirt",
  "clothingCount": 3,
  "expectedPickupTime": "2024-01-15 10:00:00"
}
```
应该返回 `price: 24`（8 × 3）。

**改状态测试**（换成店员 `13800000001` 登录拿到 token）：
```
PATCH /api/orders/1/status
{ "status": "picked_up" }
```

**看统计**（换成管理员 `13800000000` 登录）：
```
GET /api/admin/today
```

---

## 八、加新功能的套路

比如要加个"羽绒服"类型，单价 20 元：

1. 打开 `src/constants/index.js`，`ClothingType` 加 `DOWN_JACKET: 'down_jacket'`，`ClothingTypeText` 加中文
2. 打开 `src/utils/price.js`，`PRICE_MAP` 加 `[ClothingType.DOWN_JACKET]: 20`
3. 完事。校验、算价、错误提示自动同步，不用改别的文件。

比如要加个"已送回"状态：

1. `constants/index.js` 的 `OrderStatus` 加 `DELIVERED: 'delivered'`
2. `OrderStatusText` 加中文，`StatusTransitionRules` 加 `completed` 后面可以转 `delivered`
3. `models/Order.js` 的 ENUM 里加上新状态
4. `orderController.js` 改状态流转逻辑里按需加时间戳记录
5. 重启服务，`sync({ alter: true })` 会自动给表加新枚举值
