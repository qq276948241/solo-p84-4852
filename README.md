# 小区洗衣店接单系统后端

基于 Node.js + Express + MySQL 的小区洗衣店接单管理系统后端 API。

## 技术栈

- **框架**: Express 4.x
- **ORM**: Sequelize 6.x
- **数据库**: MySQL 5.7+
- **认证**: JWT
- **验证码**: 日志输出（不真发短信）
- **日志**: Winston

## 项目结构

```
project84/
├── src/
│   ├── config/              # 配置文件
│   │   └── index.js
│   ├── constants/           # 常量定义（错误码、状态、枚举）
│   │   └── index.js
│   ├── controllers/         # 控制器
│   │   ├── authController.js
│   │   ├── orderController.js
│   │   └── adminController.js
│   ├── db/                  # 数据库连接
│   │   └── sequelize.js
│   ├── middleware/          # 中间件
│   │   └── auth.js
│   ├── models/              # 数据模型
│   │   ├── User.js
│   │   ├── Order.js
│   │   ├── OrderStatusLog.js
│   │   ├── VerifyCode.js
│   │   └── index.js
│   ├── routes/              # 路由
│   │   ├── authRoutes.js
│   │   ├── orderRoutes.js
│   │   └── adminRoutes.js
│   ├── scripts/             # 脚本
│   │   └── initDB.js
│   ├── utils/               # 工具函数
│   │   ├── logger.js
│   │   ├── response.js
│   │   └── validate.js
│   └── app.js               # 入口文件
├── logs/                    # 日志目录（自动生成）
├── .env                     # 环境变量
└── package.json
```

## 快速开始

### 1. 配置数据库

编辑 `.env` 文件，修改数据库连接信息：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=laundry_order
```

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化数据库（建表 + 测试数据）

```bash
npm run init-db
```

默认会创建以下测试账号（验证码固定输出到日志）：

| 角色 | 手机号 | 说明 |
|------|--------|------|
| 管理员 | 13800000000 | 查看统计数据 |
| 店员 | 13800000001 | 处理订单、改状态 |
| 顾客1 | 13900000001 | 李阿姨，阳光小区1栋302 |
| 顾客2 | 13900000002 | 王先生，阳光小区5栋201 |

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务启动后访问：`http://localhost:3000`

健康检查：`GET http://localhost:3000/health`

---

## 统一响应格式

```json
{
  "code": 0,
  "message": "成功",
  "data": {}
}
```

- `code`: 错误码，0 表示成功，非 0 表示失败
- `message`: 描述信息
- `data`: 返回数据，失败时为 null

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 10001 | 参数缺失 |
| 10002 | 参数格式错误 |
| 10003 | 手机号格式错误 |
| 10004 | 时间冲突（取件时间太近） |
| 10005 | 数据不存在 |
| 20001 | 验证码发送失败 |
| 20002 | 验证码已过期 |
| 20003 | 验证码错误 |
| 30001 | 缺少认证 token |
| 30002 | token 无效 |
| 30003 | token 已过期 |
| 30004 | 无权限操作 |
| 40001 | 订单状态流转不合法 |
| 40002 | 订单不存在 |
| 40003 | 当前状态不允许取消订单 |
| 50000 | 服务器内部错误 |
| 50001 | 数据库操作失败 |

---

## 订单状态

| 状态值 | 显示 | 说明 |
|--------|------|------|
| `pending_pickup` | 待取件 | 顾客下单后初始状态 |
| `picked_up` | 已取走 | 店员上门取件完成 |
| `washing` | 清洗中 | 开始清洗 |
| `completed` | 已完成 | 清洗完成可送回 |
| `cancelled` | 已取消 | 订单取消 |

**状态流转规则**：
```
pending_pickup → picked_up / cancelled
    picked_up → washing / cancelled
      washing → completed
    completed → （终态）
    cancelled → （终态）
```

---

## 衣服类型

| 类型值 | 显示 |
|--------|------|
| `shirt` | 衬衫 |
| `trousers` | 裤子 |
| `coat` | 外套 |
| `dress` | 连衣裙 |
| `suit` | 西装 |
| `bedding` | 床上用品 |
| `other` | 其他 |

---

## API 接口文档

### 1. 认证模块

#### 1.1 发送验证码

**请求**: `POST /api/auth/send-code`

**Body**:
```json
{
  "phone": "13900000001",
  "role": "customer"
}
```

参数：
- `phone`: 手机号（必填）
- `role`: 角色，`customer` / `staff` / `admin`（选填，默认 customer）

**响应**:
```json
{
  "code": 0,
  "message": "验证码已发送，请查看日志",
  "data": { "sent": true }
}
```

> 验证码会输出到控制台和 `logs/combined.log` 中，格式：
> `[验证码] 手机号: xxx, 角色: xxx, 验证码: 123456, 过期时间: 2024-01-01 12:00:00`

#### 1.2 登录

**请求**: `POST /api/auth/login`

**Body**:
```json
{
  "phone": "13900000001",
  "code": "123456",
  "role": "customer"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "phone": "13900000001",
      "nickname": "顾客李阿姨",
      "role": "customer"
    }
  }
}
```

#### 1.3 获取当前用户信息

**请求**: `GET /api/auth/me`

**Header**: `Authorization: Bearer <token>`

---

### 2. 订单模块

#### 2.1 顾客下单

**请求**: `POST /api/orders`

**权限**: 顾客

**Header**: `Authorization: Bearer <token>`

**Body**:
```json
{
  "address": "阳光小区1栋302室",
  "clothingType": "shirt",
  "clothingCount": 3,
  "expectedPickupTime": "2024-01-15 10:00:00",
  "remark": "有一件衬衫有油渍"
}
```

参数：
- `address`: 取件地址（必填）
- `clothingType`: 衣服类型（必填）
- `clothingCount`: 件数，1-100 整数（必填）
- `expectedPickupTime`: 期望取件时间，不能早于当前时间（必填）
- `remark`: 备注（选填）

**可能的错误**：
- `10001` 参数缺失
- `10002` 件数不合法 / 时间格式错误 / 时间早于当前
- `10003` 衣服类型无效
- `10004` 该时间段（前后1小时）已有未完成订单

#### 2.2 查看我的订单（顾客）

**请求**: `GET /api/orders/my?page=1&pageSize=20&status=pending_pickup`

**权限**: 顾客

参数：
- `page`: 页码，默认 1
- `pageSize`: 每页条数，默认 20，最大 100
- `status`: 按状态筛选（选填）

#### 2.3 按手机号查订单（店员）

**请求**: `GET /api/orders/phone/13900000001?page=1&pageSize=20`

**权限**: 店员 / 管理员

#### 2.4 订单详情

**请求**: `GET /api/orders/:orderId`

**权限**: 所有人（顾客只能看自己的）

返回包含完整的状态时间线（`statusLogs`），可查看每个状态停留了多久。

#### 2.5 修改订单状态（店员）

**请求**: `PATCH /api/orders/:orderId/status`

**权限**: 店员 / 管理员

**Body**:
```json
{
  "status": "picked_up",
  "cancelReason": "用户临时取消",
  "remark": "已打电话确认"
}
```

参数：
- `status`: 目标状态（必填）
- `cancelReason`: 取消原因（取消时必填）
- `remark`: 备注（选填）

**状态变更时间戳自动记录**：
- `pending_pickup → picked_up`: 记录 `actualPickupTime`
- `washing → completed`: 记录 `completedTime`
- 每次状态变更都会在 `order_status_logs` 表记录一条日志

#### 2.6 所有订单列表（店员）

**请求**: `GET /api/orders?page=1&pageSize=20&status=pending_pickup&phone=13900000001&startDate=2024-01-01&endDate=2024-01-31`

**权限**: 店员 / 管理员

参数：
- `status`: 状态筛选（选填）
- `phone`: 顾客手机号筛选（选填）
- `startDate` / `endDate`: 创建时间区间（选填）

---

### 3. 管理员模块

#### 3.1 今日统计

**请求**: `GET /api/admin/today`

**权限**: 管理员

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "date": "2024-01-15",
    "todayOrdersCount": 42,
    "todayCompletedCount": 28,
    "todayClothingCount": 156,
    "pendingOrdersCount": 14,
    "statusBreakdown": {
      "pending_pickup": { "text": "待取件", "count": 8 },
      "picked_up": { "text": "已取走", "count": 4 },
      "washing": { "text": "清洗中", "count": 2 },
      "completed": { "text": "已完成", "count": 28 },
      "cancelled": { "text": "已取消", "count": 0 }
    }
  }
}
```

#### 3.2 全局状态统计

**请求**: `GET /api/admin/status`

返回所有订单按状态的统计。

#### 3.3 区间统计

**请求**: `GET /api/admin/range?startDate=2024-01-01&endDate=2024-01-15`

按天统计订单数、件数、各状态分布，以及按衣服类型统计。

#### 3.4 平均停留时长统计

**请求**: `GET /api/admin/duration`

返回每个状态的平均停留时间（毫秒 / 分钟 / 小时），可用于分析效率瓶颈。

---

## 状态日志示例

每个订单的完整状态流转都带时间戳：

```json
{
  "statusLogs": [
    {
      "fromStatus": null,
      "toStatus": "pending_pickup",
      "toStatusText": "待取件",
      "operatedBy": 3,
      "remark": "用户下单",
      "createdAt": "2024-01-14 18:30:00"
    },
    {
      "fromStatus": "pending_pickup",
      "fromStatusText": "待取件",
      "toStatus": "picked_up",
      "toStatusText": "已取走",
      "operatedBy": 2,
      "remark": "店员已取件",
      "createdAt": "2024-01-15 10:05:23"
    },
    {
      "fromStatus": "picked_up",
      "fromStatusText": "已取走",
      "toStatus": "washing",
      "toStatusText": "清洗中",
      "operatedBy": 2,
      "remark": "开始清洗",
      "createdAt": "2024-01-15 11:30:00"
    }
  ]
}
```

**计算停留时长**：相邻两条的 `createdAt` 相减即为上一个状态停留了多久。

---

## 数据库表设计

### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| phone | VARCHAR(11) UNIQUE | 手机号 |
| nickname | VARCHAR(50) | 昵称 |
| role | ENUM | customer/staff/admin |
| status | TINYINT | 1正常 0禁用 |
| created_at / updated_at / deleted_at | DATETIME | 时间戳 |

### orders（订单表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| order_no | VARCHAR(32) UNIQUE | 订单号 |
| customer_id | BIGINT | 顾客ID |
| address | VARCHAR(255) | 取件地址 |
| clothing_type | VARCHAR(32) | 衣服类型 |
| clothing_count | INT | 件数 |
| remark | VARCHAR(500) | 备注 |
| expected_pickup_time | DATETIME | 期望取件时间 |
| actual_pickup_time | DATETIME | 实际取件时间 |
| completed_time | DATETIME | 完成时间 |
| status | ENUM | 订单状态 |
| handled_by | BIGINT | 处理店员ID |
| cancel_reason | VARCHAR(255) | 取消原因 |

### order_status_logs（订单状态日志表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| order_id | BIGINT | 订单ID |
| from_status | ENUM | 原状态 |
| to_status | ENUM | 新状态 |
| operated_by | BIGINT | 操作人ID |
| remark | VARCHAR(255) | 备注 |
| created_at | DATETIME | 变更时间 |

### verify_codes（验证码表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| phone | VARCHAR(11) | 手机号 |
| code | VARCHAR(6) | 6位数字验证码 |
| role | VARCHAR(20) | 角色 |
| expires_at | DATETIME | 过期时间 |
| used | TINYINT | 是否已使用 |
