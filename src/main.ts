/**
 * 应用程序入口文件
 * ============================================================================
 * 这是整个NestJS应用的启动入口,负责:
 * 1. 创建NestJS应用实例
 * 2. 配置全局中间件(验证管道、异常过滤器等)
 * 3. 启动HTTP服务器监听请求
 * ============================================================================
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * 启动函数 - 初始化并启动应用
 */
async function bootstrap() {
  // 创建NestJS应用实例,AppModule是根模块
  const app = await NestFactory.create(AppModule);

  // ========== 全局配置 ==========

  // 设置API前缀,所有接口都会以 /api 开头
  // 例如: /api/auth/login, /api/items 等
  app.setGlobalPrefix('api');

  // 启用CORS(跨域资源共享),允许前端从不同域名访问API
  app.enableCors();

  // 全局验证管道 - 自动验证请求参数
  // whitelist: 自动过滤掉DTO中未定义的属性,防止恶意参数注入
  // transform: 自动将请求参数转换为DTO类的实例
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // 当验证失败时,返回详细的错误信息
      forbidNonWhitelisted: true,
    }),
  );

  // 全局异常过滤器 - 统一处理所有HTTP异常,返回标准化的错误响应
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局响应拦截器 - 统一包装成功响应的格式
  app.useGlobalInterceptors(new TransformInterceptor());

  // ========== 启动服务器 ==========

  // 从环境变量获取端口,默认3000
  const port = process.env.PORT || 3000;

  await app.listen(port);

  console.log('========================================');
  console.log(`🚀 校园二手交易平台后端已启动!`);
  console.log(`📡 服务地址: http://localhost:${port}/api`);
  console.log('========================================');
}

// 启动应用
bootstrap();
