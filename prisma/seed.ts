/**
 * Prisma 数据库种子脚本
 * ============================================================================
 * 这个脚本用于初始化数据库的基础数据,包括:
 * 1. 物品分类(一级和二级分类)
 * 2. 测试用户账号
 *
 * 运行方式: npx prisma db seed
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// 创建Prisma客户端实例
const prisma = new PrismaClient();

/**
 * 主函数 - 执行数据库初始化
 * 按顺序创建分类和测试用户
 */
async function main() {
  console.log('开始初始化数据库...');

  // ========== 创建物品分类 ==========
  console.log('正在创建物品分类...');

  // 一级分类:电子产品
  const electronics = await prisma.category.create({
    data: {
      name: '电子产品',
      icon: '📱',
      sort: 1,
    },
  });

  // 电子产品的二级分类
  await prisma.category.createMany({
    data: [
      { name: '手机', icon: '📱', sort: 1, parentId: electronics.id },
      { name: '电脑', icon: '💻', sort: 2, parentId: electronics.id },
      { name: '平板', icon: '📟', sort: 3, parentId: electronics.id },
      { name: '耳机', icon: '🎧', sort: 4, parentId: electronics.id },
      { name: '其他数码', icon: '🔌', sort: 5, parentId: electronics.id },
    ],
  });

  // 一级分类:图书教材
  const books = await prisma.category.create({
    data: {
      name: '图书教材',
      icon: '📚',
      sort: 2,
    },
  });

  // 图书教材的二级分类
  await prisma.category.createMany({
    data: [
      { name: '教材', icon: '📖', sort: 1, parentId: books.id },
      { name: '考试资料', icon: '📝', sort: 2, parentId: books.id },
      { name: '小说文学', icon: '📕', sort: 3, parentId: books.id },
      { name: '工具书', icon: '📗', sort: 4, parentId: books.id },
    ],
  });

  // 一级分类:生活用品
  const living = await prisma.category.create({
    data: {
      name: '生活用品',
      icon: '🏠',
      sort: 3,
    },
  });

  // 生活用品的二级分类
  await prisma.category.createMany({
    data: [
      { name: '家具', icon: '🪑', sort: 1, parentId: living.id },
      { name: '电器', icon: '🔌', sort: 2, parentId: living.id },
      { name: '床上用品', icon: '🛏️', sort: 3, parentId: living.id },
      { name: '收纳整理', icon: '📦', sort: 4, parentId: living.id },
    ],
  });

  // 一级分类:运动户外
  const sports = await prisma.category.create({
    data: {
      name: '运动户外',
      icon: '⚽',
      sort: 4,
    },
  });

  // 运动户外的二级分类
  await prisma.category.createMany({
    data: [
      { name: '球类', icon: '🏀', sort: 1, parentId: sports.id },
      { name: '健身器材', icon: '💪', sort: 2, parentId: sports.id },
      { name: '自行车', icon: '🚲', sort: 3, parentId: sports.id },
      { name: '户外装备', icon: '🏕️', sort: 4, parentId: sports.id },
    ],
  });

  // 一级分类:服饰鞋包
  const clothing = await prisma.category.create({
    data: {
      name: '服饰鞋包',
      icon: '👕',
      sort: 5,
    },
  });

  // 服饰鞋包的二级分类
  await prisma.category.createMany({
    data: [
      { name: '衣服', icon: '👔', sort: 1, parentId: clothing.id },
      { name: '鞋子', icon: '👟', sort: 2, parentId: clothing.id },
      { name: '包包', icon: '👜', sort: 3, parentId: clothing.id },
      { name: '配饰', icon: '🧣', sort: 4, parentId: clothing.id },
    ],
  });

  // 一级分类:其他
  await prisma.category.create({
    data: {
      name: '其他',
      icon: '📦',
      sort: 99,
    },
  });

  console.log('物品分类创建完成!');

  // ========== 创建测试用户 ==========
  console.log('正在创建测试用户...');

  // 对密码进行加密,所有测试用户密码都是 "123456"
  const hashedPassword = await bcrypt.hash('123456', 10);

  await prisma.user.createMany({
    data: [
      {
        studentId: '2021001',
        password: hashedPassword,
        nickname: '张三',
        campus: '东校区',
        phone: '13800000001',
      },
      {
        studentId: '2021002',
        password: hashedPassword,
        nickname: '李四',
        campus: '西校区',
        phone: '13800000002',
      },
      {
        studentId: '2021003',
        password: hashedPassword,
        nickname: '王五',
        campus: '南校区',
        phone: '13800000003',
      },
    ],
  });

  console.log('测试用户创建完成!');
  console.log('========================================');
  console.log('测试账号信息:');
  console.log('学号: 2021001 / 2021002 / 2021003');
  console.log('密码: 123456');
  console.log('========================================');
  console.log('数据库初始化完成!');
}

// 执行主函数
main()
  .catch((e) => {
    console.error('数据库初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    // 断开数据库连接
    await prisma.$disconnect();
  });
