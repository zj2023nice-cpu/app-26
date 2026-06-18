/**
 * 公开接口装饰器
 * ============================================================================
 * 在系统中,默认所有接口都需要JWT认证(通过全局守卫)
 * 但有些接口是公开的,不需要登录就能访问(如登录、注册、浏览物品列表)
 *
 * 使用 @Public() 装饰器标记这些公开接口
 *
 * 使用示例:
 * ```typescript
 * @Public()
 * @Get('items')
 * findAllItems() { ... }
 * ```
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

/**
 * 元数据键名,用于标识公开接口
 * JwtAuthGuard会检查这个元数据来决定是否跳过认证
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public装饰器
 * 使用SetMetadata设置元数据,JwtAuthGuard会读取这个元数据
 *
 * @returns 装饰器函数
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
