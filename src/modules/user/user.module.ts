/**
 * 用户模块
 * ============================================================================
 * UserModule整合了用户相关的组件
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
