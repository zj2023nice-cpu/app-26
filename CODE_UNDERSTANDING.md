# 物品状态流转逻辑深度分析

## 一、状态枚举定义

| 状态 | 说明 |
|------|------|
| `DRAFT` | 草稿（schema中定义但代码未实际使用） |
| `ACTIVE` | 上架中 - 可被浏览、下单、发起互换 |
| `RESERVED` | 已预订 - 有进行中的交易，暂时不可操作 |
| `SOLD` | 已售出 - 交易完成 |
| `OFF_SHELF` | 已下架 - 用户主动下架 |

---

## 二、出售订单链路状态流转

### 2.1 触发点与副作用

| 操作 | 触发者 | 前置校验 | 订单状态变化 | 物品状态变化 | 其他副作用 | 代码位置 |
|------|--------|----------|--------------|--------------|------------|----------|
| 创建订单 (下单) | 买家 | 1. 物品存在<br>2. 物品状态 === `ACTIVE`<br>3. 不能买自己的物品<br>4. 物品类型 === `SELL` | `PENDING` | `ACTIVE` → `RESERVED` | 事务内原子操作 | [order.service.ts:41-99](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/order/order.service.ts#L41-L99) |
| 卖家确认订单 | 卖家 | 1. 订单存在<br>2. 操作者是卖家<br>3. 订单状态 === `PENDING` | `PENDING` → `CONFIRMED` | **无变化** (保持 `RESERVED`) | 无 | [order.service.ts:148-169](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/order/order.service.ts#L148-L169) |
| 买家确认收货 | 买家 | 1. 订单存在<br>2. 操作者是买家<br>3. 订单状态 === `CONFIRMED` | `CONFIRMED` → `COMPLETED` | `RESERVED` → `SOLD` | 卖家信用分 +5 | [order.service.ts:177-215](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/order/order.service.ts#L177-L215) |
| 取消订单 | 买家/卖家 | 1. 订单存在<br>2. 操作者是买家或卖家<br>3. 订单状态是 `PENDING` 或 `CONFIRMED` | `*` → `CANCELLED` | **强制** → `ACTIVE` | 无 | [order.service.ts:223-260](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/order/order.service.ts#L223-L260) |

### 2.2 订单链路状态图

```
                          ┌─────────────────────────────────────────┐
                          │           物品状态: ACTIVE               │
                          └─────────────────────────────────────────┘
                                              │
                                    买家下单 (创建订单)
                                              │
                                              ▼
┌─────────────────┐                ┌─────────────────────────────────────────┐
│  订单: CANCELLED│◄───────────────│           物品状态: RESERVED             │
└─────────────────┘   取消订单     └─────────────────────────────────────────┘
        ▲                           │                      │
        │                    卖家确认订单           买家确认收货
        │                           │                      │
        │                           ▼                      ▼
┌─────────────────┐      ┌─────────────────┐    ┌─────────────────────────────────┐
│                 │      │ 订单: CONFIRMED │    │        物品状态: SOLD            │
│  (无终态)       │      └─────────────────┘    └─────────────────────────────────┘
│                 │                │                      ▲
└─────────────────┘                │                      │
                          取消订单 │                      │
                                   │                      │
                                   ▼                      │
                          ┌─────────────────┐             │
                          │ 订单: COMPLETED │─────────────┘
                          └─────────────────┘
```

---

## 三、互换请求链路状态流转

### 3.1 触发点与副作用

| 操作 | 触发者 | 前置校验 | 互换状态变化 | 物品状态变化 | 其他副作用 | 代码位置 |
|------|--------|----------|--------------|--------------|------------|----------|
| 发起互换请求 | 请求者 | 1. 目标物品存在<br>2. 目标物品状态 === `ACTIVE`<br>3. 目标物品类型 === `EXCHANGE`<br>4. 不能和自己互换<br>5. 自己的物品存在<br>6. 自己的物品属于自己<br>7. **自己的物品状态 === `ACTIVE`**<br>8. 不存在相同的进行中请求 | `PENDING` | **无变化！两个物品都保持 `ACTIVE`** | 无 | [exchange.service.ts:28-102](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/exchange/exchange.service.ts#L28-L102) |
| 物品主人接受 | 被请求者 | 1. 互换请求存在<br>2. 操作者是物品主人<br>3. 互换状态 === `PENDING` | `PENDING` → `ACCEPTED` | **双方物品** → `RESERVED` | 事务内操作 | [exchange.service.ts:156-188](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/exchange/exchange.service.ts#L156-L188) |
| 物品主人拒绝 | 被请求者 | 1. 互换请求存在<br>2. 操作者是物品主人<br>3. 互换状态 === `PENDING` | `PENDING` → `REJECTED` | **无变化** | 无 | [exchange.service.ts:196-217](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/exchange/exchange.service.ts#L196-L217) |
| 确认互换完成 | 任意一方 | 1. 互换请求存在<br>2. 操作者是请求者或主人<br>3. 互换状态 === `ACCEPTED` | `ACCEPTED` → `COMPLETED` | **双方物品** → `SOLD` | 双方信用分各 +5 | [exchange.service.ts:226-265](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/exchange/exchange.service.ts#L226-L265) |

### 3.2 互换链路状态图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         物品A: ACTIVE  │  物品B: ACTIVE                      │
│  (互换请求创建时不修改状态！两个物品仍然可以被其他人下单/发起互换！)          │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
                          │ 发起互换请求 (PENDING)
                          ▼
             ┌─────────────────────────────────┐
             │      互换状态: PENDING           │
             │  (物品状态不变，仍是ACTIVE！)    │
             └─────────────────────────────────┘
                │              │
       主人拒绝 │              │ 主人接受
                ▼              ▼
┌───────────────────────┐   ┌─────────────────────────────────────────────────┐
│ 互换状态: REJECTED    │   │ 互换状态: ACCEPTED                              │
│ (物品状态不变)        │   │ 物品A: RESERVED  │  物品B: RESERVED             │
└───────────────────────┘   └─────────────────────────────────────────────────┘
                                       │
                                       │ 任意一方确认完成
                                       ▼
                          ┌─────────────────────────────────────────────────┐
                          │ 互换状态: COMPLETED                             │
                          │ 物品A: SOLD      │  物品B: SOLD                  │
                          └─────────────────────────────────────────────────┘
```

⚠️ **重大发现：互换请求被接受之前，两个物品都没有被锁定！**

---

## 四、物品自主操作链路

| 操作 | 触发者 | 前置校验 | 物品状态变化 | 代码位置 |
|------|--------|----------|--------------|----------|
| 发布物品 | 发布者 | 分类存在 | (DRAFT schema默认，但代码直接设为) `ACTIVE` | [item.service.ts:32-57](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/item/item.service.ts#L32-L57) |
| 下架物品 | 发布者 | 1. 物品存在<br>2. 是自己的物品 | 任意状态 → `OFF_SHELF` | [item.service.ts:294-311](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/item/item.service.ts#L294-L311) |
| 重新上架 | 发布者 | 1. 物品存在<br>2. 是自己的物品<br>3. 当前状态 === `OFF_SHELF` | `OFF_SHELF` → `ACTIVE` | [item.service.ts:319-340](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/item/item.service.ts#L319-L340) |
| 删除物品 | 发布者 | 1. 物品存在<br>2. 是自己的物品<br>3. **无 PENDING/CONFIRMED 状态的订单** | 删除 | [item.service.ts:256-286](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/item/item.service.ts#L256-L286) |

---

## 五、完整状态转换总图

```
                             ┌──────────────┐
                             │    DRAFT     │ ◄── schema定义但代码未使用
                             └──────────────┘
                                    │
                                    │ (发布物品直接跳过)
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │                      ACTIVE                              │
        │  ┌───────────────────────────────────────────────────┐  │
        │  │  可被下单、可被发起互换、可被收藏、可被下架、可编辑  │  │
        │  └───────────────────────────────────────────────────┘  │
        └─────────────┬───────────────────────────┬───────────────┘
                      │                           │
          ┌───────────┘                           └───────────┐
          │ 买家下单 (订单)                                    │ 主人接受互换 (互换)
          │ (SELL类型物品)                                     │ (EXCHANGE类型物品)
          ▼                                                    ▼
┌──────────────────────┐                           ┌──────────────────────┐
│      RESERVED        │◄──────────────────────────│      RESERVED        │
│  (订单 PENDING/      │                           │  (互换 ACCEPTED,     │
│   CONFIRMED 状态)    │                           │   双方物品都锁定)    │
└──────────┬───────────┘                           └──────────┬───────────┘
           │ 订单取消                                        │ 互换完成
           │ (强制改回ACTIVE, 不管其他!)                       │ (任何一方确认即可)
           │                                                    │
           ▼                                                    ▼
┌──────────────────────┐                           ┌──────────────────────┐
│       ACTIVE         │                           │        SOLD          │
└──────────────────────┘                           └──────────────────────┘
           ▲                                                    ▲
           │                                                    │
           │ 订单完成 (买家确认收货)                              │
           └────────────────────────────────────────────────────┘
                      │
                      │ 用户主动下架 (任何时候都能下!)
                      ▼
             ┌──────────────────────┐
             │      OFF_SHELF       │
             │  (仅能从OFF_SHELF重新上架)
             └──────────────────────┘
```

---

## 六、并发与边界场景问题分析

### 🚨 问题 1：互换请求创建时不锁定物品 → 双重交易冲突

**严重程度：CRITICAL**

**场景复现：**

```
时间线：
T1: 用户A有一个EXCHANGE类型物品X（ACTIVE状态）
T2: 用户B发起互换请求，想用自己的物品Y换X
    → ExchangeService.create() 执行：
       - 检查 X.status === ACTIVE ✓
       - 检查 Y.status === ACTIVE ✓
       - 创建 PENDING 状态的互换请求
       - ❌ 没有把 X 和 Y 改成 RESERVED！
T3: 用户C看到物品X还是ACTIVE状态，也发起了一个互换请求
    → 同样检查通过，成功创建第二个 PENDING 请求
T4: 同时用户D也看到X是ACTIVE，因为type是EXCHANGE理论上不能下单，但如果...
    （等等，看下面问题2）
T5: 物品主人A先接受了B的互换请求
    → X 和 Y 被改为 RESERVED ✓
T6: 然后A又接受了C的互换请求
    → ❌ 接受时没有重新检查物品状态！updateMany直接执行
    → X 和 C的物品Z 被再次设置为 RESERVED（虽然已经是RESERVED）
    → 现在有两个 ACCEPTED 状态的互换请求指向同一个物品X！
```

**代码位置问题：**
- [exchange.service.ts:84-99](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/exchange/exchange.service.ts#L84-L99) - 创建互换时不锁物品
- [exchange.service.ts:174-187](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/exchange/exchange.service.ts#L174-L187) - 接受时不重新校验状态

**后果：** 同一个物品可以被多次"锁定"在不同的互换交易中，最后哪方完成交易完全看谁先点确认。

---

### 🚨 问题 2：订单取消时盲目恢复 ACTIVE → 状态覆盖问题

**严重程度：HIGH**

**场景复现：**

```
时间线：
T1: 物品X是SELL类型，ACTIVE状态
T2: 用户B下单买X → 订单1创建，X变成RESERVED ✓
T3: 用户B突然不想要了，但是还没等取消，另一个情况发生：
    （或者场景B）
T3: 物品主人A有一个EXCHANGE类型物品Y
T4: 用户C发互换请求想换Y → PENDING，Y还是ACTIVE
T5: 用户D同时下单买了另一个物品Z，而订单和互换混在一起时...

更直接的场景：
T1: 物品X（SELL）ACTIVE
T2: 订单1创建，X→RESERVED
T3: 此时物品被下架（见问题3），X→OFF_SHELF（不对，下架不检查状态）
T4: 订单1被取消 → 代码直接执行 X→ACTIVE
    → ❌ 本来应该是OFF_SHELF的，被强制改回ACTIVE了！

或者更严重：
T1: 物品X是EXCHANGE类型（理论上EXCHANGE不能下单，但代码有没有校验？）
    → order.service.ts:65 检查了 item.type !== 'SELL' 就报错，所以EXCHANGE物品不能下单，这个没问题

但互换和订单同时存在时：
T1: 用户同时有两个物品？不，看这个场景：
T1: 物品X同时...等等，物品的type是固定的，SELL就是SELL，EXCHANGE就是EXCHANGE
    但是互换涉及两个物品！看：

T1: 用户A的物品X是SELL类型，ACTIVE
T2: 用户B下单买X → X→RESERVED（订单1 PENDING）
T3: 用户C不知道X已被预订（因为RESERVED的物品在列表页不显示）
    但是...列表页只查ACTIVE的物品，所以C看不到
T4: 但是！用户C之前已经打开了物品X的详情页，页面是缓存的
T5: 用户B取消订单 → X→ACTIVE
T6: 同时，用户D刚好在T5之前用自己的EXCHANGE物品Y（哦不对X是SELL类型不能互换）

真正的问题场景：
T1: 用户A有一个EXCHANGE物品X，ACTIVE
T2: 用户B发起互换请求（请求号E1），X还是ACTIVE
T3: 用户C又发起了另一个互换请求（请求号E2），X还是ACTIVE
T4: A接受了E1 → X和B的物品Y都变成RESERVED
T5: 然后A又接受了E2 → 代码执行updateMany，X还是被设为RESERVED（已经是了）
    → 但是C的物品Z也被设为RESERVED了！
T6: 现在E1被取消？等等，互换接受后没有取消接口！
    → exchange.controller.ts 里只有 reject，只对 PENDING 状态有效
    → ACCEPTED 状态的互换请求无法取消！
```

**代码位置问题：**
- [order.service.ts:246-259](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/order/order.service.ts#L246-L259) - 取消订单时直接 `status: ItemStatus.ACTIVE`，不检查当前物品状态，也不检查有没有其他进行中的交易。

---

### 🚨 问题 3：下架/删除物品的校验不完整

**严重程度：HIGH**

**场景复现：**

```
场景A - 下架不检查任何交易状态：
T1: 物品X被下单，状态RESERVED
T2: 卖家点"下架" → offShelf() 直接执行
    → 代码只检查：物品存在、是自己的，就直接改成OFF_SHELF
    → ❌ 不管有没有正在进行的订单或互换！
T3: 然后订单被确认、完成，complete()执行 X→SOLD
    → 覆盖了OFF_SHELF状态
    或者订单被取消，X被强制改回ACTIVE，覆盖了用户的下架操作

场景B - 删除物品只检查订单不检查互换：
T1: 物品X是EXCHANGE类型，有人发了互换请求
T2: 主人接受了互换，X→RESERVED
T3: 主人点删除物品
    → remove() 只查有没有 PENDING/CONFIRMED 的订单
    → ❌ 完全没检查互换请求！
    → 物品被成功删除！
    → 然后互换完成时，去更新一个已经不存在的itemId → 数据库错误！
```

**代码位置问题：**
- [item.service.ts:294-311](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/item/item.service.ts#L294-L311) - offShelf() 没有任何状态校验
- [item.service.ts:270-280](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/item/item.service.ts#L270-L280) - remove() 只查订单不查互换

---

### 🚨 问题 4：并发下单竞态条件

**严重程度：MEDIUM-HIGH**

**场景复现：**

```
虽然用了事务，但没有乐观锁或悲观锁！

时间线（并发）：
T1: 物品X ACTIVE
T2: 请求1（用户B下单）: 读取item，status=ACTIVE ✓
T3: 请求2（用户C下单）: 也读取item，status=ACTIVE ✓
T4: 请求1事务开始: 创建订单，更新item→RESERVED，提交 ✓
T5: 请求2事务开始: 创建订单，更新item（where: {id}，没有where status=ACTIVE）
    → 更新成功！item又被写了一次RESERVED
    → ❌ 结果：两个PENDING订单同时存在，都指向同一个物品！

问题在于：
prisma.item.update({
  where: { id: itemId },  // ❌ 只按id更新，没有加状态条件
  data: { status: ItemStatus.RESERVED },
})

正确应该是：
where: { id: itemId, status: ItemStatus.ACTIVE }
然后检查affectedRows === 1，否则回滚
```

**代码位置问题：**
- [order.service.ts:90-93](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/order/order.service.ts#L90-L93) - 更新时没有乐观锁条件
- [exchange.service.ts:181-184](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/exchange/exchange.service.ts#L181-L184) - 同样问题

---

### 🚨 问题 5：互换接受后无法取消，状态卡死

**严重程度：MEDIUM**

**场景复现：**

```
T1: 互换被接受，双方物品RESERVED
T2: 双方线下见面发现物品不合适，想取消
T3: 发现：
    - reject() 只对 PENDING 状态有效
    - 没有 cancel 接口处理 ACCEPTED 状态的互换
    → ❌ 两个物品永远卡在 RESERVED 状态，只能走 complete 变成 SOLD
    → 或者通过数据库手动修改
```

**代码位置问题：**
- [exchange.controller.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-jupiter/src/modules/exchange/exchange.controller.ts) - 缺少 ACCEPTED 状态的取消接口

---

## 七、所有写物品状态的代码点汇总

| 位置 | 触发条件 | 写入状态 | 是否加where条件 | 是否在事务中 |
|------|----------|----------|-----------------|-------------|
| item.service.ts:47 | 发布物品 | ACTIVE | 新建 | 否 |
| item.service.ts:309 | 下架物品 | OFF_SHELF | 仅id | 否 |
| item.service.ts:338 | 重新上架 | ACTIVE | 仅id | 否 |
| order.service.ts:92 | 创建订单 | RESERVED | 仅id | 是 |
| order.service.ts:204 | 订单完成 | SOLD | 仅id | 是 |
| order.service.ts:255 | 取消订单 | ACTIVE | 仅id | 是 |
| exchange.service.ts:183 | 接受互换 | RESERVED (两个物品) | id in [...] | 是 |
| exchange.service.ts:254 | 互换完成 | SOLD (两个物品) | id in [...] | 是 |

---

## 八、总结：核心设计缺陷

1. **互换链路的"延迟锁定"问题**：发起互换请求时不锁定物品，直到接受才锁定，但接受时又不校验当前状态，导致重复锁定可能。

2. **状态写入无条件保护**：所有更新物品状态的地方都只按 `id` 更新，没有乐观锁（`where id + status`）。

3. **状态恢复简单粗暴**：取消订单时无脑改回 ACTIVE，既不检查物品当前真实状态，也不检查是否有其他进行中的交易。

4. **跨链路状态不同步**：物品模块不知道互换模块的存在，删除/下架只检查订单不检查互换。

5. **缺少互换取消功能**：接受后无法回退，状态可能永久卡死。
