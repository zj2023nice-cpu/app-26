/**
 * Prisma模块
 * ============================================================================
 * 这个模块将PrismaService导出为全局服务
 * 其他模块可以直接注入PrismaService来访问数据库,无需单独导入此模块
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global() - 将此模块标记为全局模块
 * 全局模块只需要在AppModule中导入一次,其他模块就可以直接使用其导出的服务
 * 这对于像数据库服务这样到处都需要使用的服务非常方便
 */
@Global()
@Module({
  providers: [PrismaService], // 注册PrismaService作为提供者
  exports: [PrismaService], // 导出PrismaService,让其他模块可以使用
})
export class PrismaModule {}
