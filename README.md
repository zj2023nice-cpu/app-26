# 校园二手物品交易与资源共享平台 - 后端

基于 NestJS + TypeScript + Prisma + MySQL 的校园二手交易平台后端系统。

## 功能特性

- **用户管理**: 学号注册登录、JWT认证、个人信息管理
- **物品管理**: 发布物品(出售/互换)、搜索筛选、收藏功能
- **订单系统**: 下单购买、订单状态流转、交易评价
- **互换系统**: 发起互换请求、接受/拒绝、完成互换
- **消息系统**: 站内私信、系统通知
- **评价系统**: 交易评价、信用分机制

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 20 |
| 语言 | TypeScript 5.x |
| 框架 | NestJS 10.x |
| ORM | Prisma 5.x |
| 数据库 | MySQL 8.0 |
| 认证 | JWT + Passport |
| 容器 | Docker + Compose |

## 快速开始

### 方式一: Docker一键启动 (推荐)

只需安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/),无需安装Node.js或其他依赖。

```bash
# 1. 进入项目目录
cd campus-trade

# 2. 一键启动所有服务(后端+数据库+自动初始化)
docker-compose up -d

# 3. 查看启动日志(等待初始化完成)
docker-compose logs -f api
```

首次启动时,系统会自动:
- 构建后端镜像(安装依赖、编译代码)
- 启动MySQL数据库
- 等待数据库就绪
- 执行数据库迁移
- 初始化测试数据

服务启动后:
- API地址: http://localhost:3000/api
- 数据库: localhost:3306

### 方式二: 本地开发

需要安装 Node.js 20+ 和 Docker(用于MySQL)。

```bash
# 1. 进入项目目录
cd campus-trade

# 2. 安装依赖
npm install

# 3. 启动MySQL数据库
docker-compose -f docker-compose.dev.yml up -d

# 4. 配置环境变量
cp .env.example .env
# 编辑.env文件,确保DATABASE_URL正确

# 5. 初始化数据库
npx prisma migrate dev
npx prisma db seed

# 6. 启动开发服务器
npm run start:dev
```

## 测试账号

初始化数据库后,可使用以下测试账号:

| 学号 | 密码 |
|------|------|
| 2021001 | 123456 |
| 2021002 | 123456 |
| 2021003 | 123456 |

## API接口

### 认证模块 `/api/auth`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | /register | 注册 | 否 |
| POST | /login | 登录 | 否 |
| POST | /change-password | 修改密码 | 是 |
| POST | /refresh | 刷新Token | 是 |

### 用户模块 `/api/users`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /me | 当前用户信息 | 是 |
| PATCH | /me | 更新资料 | 是 |
| GET | /me/items | 我的物品 | 是 |
| GET | /me/orders | 我的订单 | 是 |
| GET | /:id | 查看他人信息 | 否 |

### 分类模块 `/api/categories`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | / | 分类列表(树形) | 否 |
| GET | /flat | 分类列表(平铺) | 否 |
| GET | /:id | 分类详情 | 否 |

### 物品模块 `/api/items`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | / | 发布物品 | 是 |
| GET | / | 物品列表 | 否 |
| GET | /favorites | 收藏列表 | 是 |
| GET | /:id | 物品详情 | 否 |
| PATCH | /:id | 编辑物品 | 是 |
| DELETE | /:id | 删除物品 | 是 |
| POST | /:id/off-shelf | 下架 | 是 |
| POST | /:id/on-shelf | 上架 | 是 |
| POST | /:id/favorite | 收藏 | 是 |
| DELETE | /:id/favorite | 取消收藏 | 是 |

### 订单模块 `/api/orders`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | / | 创建订单 | 是 |
| GET | /:id | 订单详情 | 是 |
| POST | /:id/confirm | 卖家确认 | 是 |
| POST | /:id/complete | 确认收货 | 是 |
| POST | /:id/cancel | 取消订单 | 是 |

### 互换模块 `/api/exchanges`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | / | 发起互换 | 是 |
| GET | /my | 我的互换 | 是 |
| POST | /:id/accept | 接受 | 是 |
| POST | /:id/reject | 拒绝 | 是 |
| POST | /:id/complete | 完成 | 是 |

### 消息模块 `/api/messages`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | / | 发送私信 | 是 |
| GET | / | 消息列表 | 是 |
| GET | /conversation/:userId | 对话记录 | 是 |
| POST | /:id/read | 标记已读 | 是 |
| POST | /read-all | 全部已读 | 是 |

### 评价模块 `/api/reviews`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | / | 创建评价 | 是 |
| GET | /user/:userId | 用户评价 | 否 |
| GET | /order/:orderId | 订单评价 | 是 |

## 请求/响应格式

### 请求头

需要认证的接口,在Header中携带JWT Token:
```
Authorization: Bearer <token>
```

### 响应格式

成功响应:
```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

错误响应:
```json
{
  "code": 400,
  "message": "错误信息",
  "timestamp": "2024-01-19T12:00:00.000Z"
}
```

## 项目结构

```
campus-trade/
├── prisma/
│   ├── schema.prisma      # 数据库模型定义
│   ├── seed.ts            # 初始数据脚本
│   └── migrations/        # 数据库迁移
├── src/
│   ├── main.ts            # 应用入口
│   ├── app.module.ts      # 根模块
│   ├── common/            # 通用模块
│   │   ├── decorators/    # 自定义装饰器
│   │   ├── guards/        # 认证守卫
│   │   ├── filters/       # 异常过滤器
│   │   ├── interceptors/  # 响应拦截器
│   │   └── dto/           # 通用DTO
│   ├── modules/           # 业务模块
│   │   ├── auth/          # 认证
│   │   ├── user/          # 用户
│   │   ├── category/      # 分类
│   │   ├── item/          # 物品
│   │   ├── order/         # 订单
│   │   ├── exchange/      # 互换
│   │   ├── message/       # 消息
│   │   └── review/        # 评价
│   └── prisma/            # Prisma服务
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 常用命令

```bash
# 开发
npm run start:dev      # 开发模式启动
npm run build          # 编译

# 数据库
npx prisma migrate dev     # 创建迁移
npx prisma migrate deploy  # 部署迁移
npx prisma db seed         # 初始化数据
npx prisma studio          # 数据库GUI

# Docker
docker-compose up -d       # 启动所有服务
docker-compose down        # 停止服务
docker-compose logs -f api # 查看日志
```

## 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DATABASE_URL | 数据库连接URL | mysql://root:password@localhost:3306/campus_trade |
| JWT_SECRET | JWT签名密钥 | your-secret-key |
| JWT_EXPIRES_IN | Token过期时间 | 7d |
| PORT | 服务端口 | 3000 |
| NODE_ENV | 运行环境 | development / production |

## 许可证

MIT
