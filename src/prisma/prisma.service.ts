/**
 * Prisma服务
 * ============================================================================
 * PrismaService是对Prisma客户端的封装,提供数据库连接管理功能
 *
 * 为什么需要封装?
 * 1. 统一管理数据库连接的生命周期
 * 2. 在应用关闭时正确断开数据库连接,避免连接泄漏
 * 3. 方便在整个应用中通过依赖注入使用数据库服务
 * ============================================================================
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma数据库服务类
 * 继承自PrismaClient,这样可以直接使用所有Prisma的数据库操作方法
 *
 * @Injectable() - 标记这个类可以被NestJS的依赖注入系统管理
 * OnModuleInit - 模块初始化时的生命周期钩子
 * OnModuleDestroy - 模块销毁时的生命周期钩子
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * 模块初始化时自动调用
   * 建立数据库连接
   */
  async onModuleInit() {
    // $connect() 是Prisma提供的方法,用于建立数据库连接
    // 虽然Prisma会在首次查询时自动连接,但显式连接可以更早发现连接问题
    await this.$connect();
    console.log('✅ 数据库连接成功');
  }

  /**
   * 模块销毁时自动调用(如应用关闭)
   * 断开数据库连接,释放资源
   */
  async onModuleDestroy() {
    // $disconnect() 断开所有数据库连接
    await this.$disconnect();
    console.log('📴 数据库连接已断开');
  }
}
