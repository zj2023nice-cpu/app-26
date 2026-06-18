# ============================================================================
# Dockerfile - 校园二手交易平台后端镜像构建文件
# ============================================================================
# 这个文件定义了如何将NestJS应用打包成Docker镜像
# 使用多阶段构建来减小最终镜像大小
# ============================================================================

# ==================== 第一阶段: 构建阶段 ====================
# 使用Node.js 20 Alpine版本作为基础镜像(体积更小)
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 首先只复制package.json
# 这样可以利用Docker的缓存机制,只有依赖变化时才重新安装
COPY package.json ./

# 安装所有依赖(包括devDependencies,因为需要编译TypeScript)
# 使用npm install而不是npm ci,因为不依赖package-lock.json
RUN npm install

# 复制Prisma schema(需要在生成客户端之前)
COPY prisma ./prisma

# 生成Prisma客户端
RUN npx prisma generate

# 复制源代码
COPY . .

# 编译TypeScript为JavaScript
RUN npm run build

# 单独编译seed.ts文件到dist/prisma目录
# 因为nest build只编译src目录,不会编译prisma/seed.ts
# 使用--outDir dist让tsc保持目录结构,prisma/seed.ts会被编译到dist/prisma/seed.js
RUN npx tsc prisma/seed.ts --outDir dist --module commonjs --esModuleInterop --skipLibCheck --resolveJsonModule

# ==================== 第二阶段: 生产阶段 ====================
# 使用相同的基础镜像
FROM node:20-alpine AS production

# 安装 OpenSSL（Prisma 运行时依赖）
RUN apk add --no-cache openssl

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production

# 只复制生产所需的文件
# 1. package.json
COPY package.json ./

# 2. 安装生产依赖 + prisma CLI（用于运行时数据库同步）
RUN npm install --only=production && npm install prisma

# 3. 复制Prisma相关文件并重新生成客户端（确保二进制文件匹配运行环境）
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate

# 4. 复制编译后的代码
COPY --from=builder /app/dist ./dist

# 5. 复制启动脚本
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# 暴露应用端口
EXPOSE 3000

# 启动命令 - 使用启动脚本自动完成数据库初始化
CMD ["./docker-entrypoint.sh"]
