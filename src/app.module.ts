/**
 * 应用根模块
 * ============================================================================
 * AppModule是整个应用的根模块,负责:
 * 1. 导入所有功能模块
 * 2. 配置全局服务(如配置模块、限流模块)
 *
 * NestJS使用模块来组织代码,每个功能模块负责一个特定的业务领域
 * 所有模块最终都汇总到AppModule中
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// 导入Prisma数据库服务模块
import { PrismaModule } from './prisma/prisma.module';

// 导入各个功能模块
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CategoryModule } from './modules/category/category.module';
import { ItemModule } from './modules/item/item.module';
import { OrderModule } from './modules/order/order.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { MessageModule } from './modules/message/message.module';
import { ReviewModule } from './modules/review/review.module';

@Module({
  imports: [
    // ========== 全局配置模块 ==========
    // ConfigModule用于管理环境变量,isGlobal: true表示全局可用
    // 这样其他模块不需要单独导入就能使用ConfigService
    ConfigModule.forRoot({
      isGlobal: true, // 全局模块,所有模块都可以注入ConfigService
      envFilePath: '.env', // 环境变量文件路径
    }),

    // ========== 限流模块 ==========
    // ThrottlerModule用于限制API请求频率,防止恶意攻击
    // ttl: 时间窗口(毫秒),limit: 窗口内最大请求数
    // 这里配置为60秒内最多100次请求
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60秒
        limit: 100, // 最多100次请求
      },
    ]),

    // ========== 数据库模块 ==========
    PrismaModule,

    // ========== 业务功能模块 ==========
    AuthModule, // 认证模块 - 登录、注册、JWT
    UserModule, // 用户模块 - 用户信息管理
    CategoryModule, // 分类模块 - 物品分类管理
    ItemModule, // 物品模块 - 物品发布与管理
    OrderModule, // 订单模块 - 买卖订单管理
    ExchangeModule, // 互换模块 - 以物换物
    MessageModule, // 消息模块 - 站内消息
    ReviewModule, // 评价模块 - 交易评价
  ],
  providers: [
    // 全局启用限流守卫
    // 这意味着所有接口都会受到限流保护
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
