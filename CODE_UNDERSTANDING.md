# 物品状态机深度分析

> 涉及模块：[item.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/item/item.service.ts)、[order.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts)、[exchange.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts)、[schema.prisma](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/prisma/schema.prisma)

---

## 一、核心枚举定义

### 物品状态（ItemStatus）

| 状态 | 含义 |
|------|------|
| `DRAFT` | 草稿（schema 中有定义，但业务代码从未使用，发布即 ACTIVE） |
| `ACTIVE` | 上架中，可被下单/互换 |
| `RESERVED` | 已预订，存在进行中的订单或互换 |
| `SOLD` | 已售出/已互换完成，终态 |
| `OFF_SHELF` | 用户主动下架 |

### 订单状态（OrderStatus）

`PENDING` → `CONFIRMED` → `COMPLETED`（终态），任意时刻可 → `CANCELLED`（终态）

### 互换状态（ExchangeStatus）

`PENDING` → `ACCEPTED` → `COMPLETED`（终态），`PENDING` 时可 → `REJECTED`（终态）

---

## 二、物品状态转换总图（ASCII）

下图中每条转换边上的标注格式为：`[触发模块] 触发点 | 触发者 | 副作用`

```

                          ┌──────────────────────────────────────────────────────┐
                          │                     物品 Item                        │
                          └──────────────────────────────────────────────────────┘

      ┌─────────────┐  [item] create         ┌─────────────┐
      │   DRAFT     │ ──────────────────────▶ │   ACTIVE    │ ◀───────────────────┐
      │ (未实际使用) │   (发布者)              │  (在售)     │                     │
      └─────────────┘                         └──────┬──────┘                     │
                                                      │                            │
                   ┌──────────────────────────────────┼────────────────────────────┐│
                   │                                  │                            ││
     [item] offShelf│                    [order] create│买家                         ││
       (发布者)     │                       (事务内)   │                            ││
                   │                                  ▼                            ││
                   │                          ┌─────────────┐   [order] cancel     ││
                   │                          │  RESERVED   │ ─────────────────────┘│
                   │                          │ (已预订)    │   (买/卖家，事务内)   │
                   │                          └──────┬──────┘                       │
                   │                                 │                              │
                   │         ┌───────────────────────┼───────────────────────┐      │
                   │         │                       │                       │      │
                   │ [order] complete│买家    [exchange] accept│owner          │ [exchange]│
                   │  (事务内)           (事务内，双边锁)                complete│任意一方
                   │         │                       │                  (事务内)│
                   │         │                       │                       │      │
                   │         ▼                       ▼                       ▼      │
                   │  ┌─────────────┐        ┌─────────────┐           ┌─────────────┐
                   └▶│    SOLD     │        │  RESERVED   │           │    SOLD     │
         [item]      │  (已售出)   │        │ (互换锁定)  │ ─────────▶│ (互换完成)  │
         remove     └─────────────┘        └─────────────┘            └─────────────┘
        (物理删除，
         仅校验订单)                                    │
        ┌─────────────┐                                 │
        │  OFF_SHELF  │ ◀───────────────────────────────┘
        │  (已下架)   │      [item] offShelf (发布者，无状态校验)
        └──────┬──────┘
               │
               │ [item] onShelf (发布者，强制 ACTIVE)
               └──────────────────────────────────────▶ ACTIVE

```

> ⚠️ 关键观察：DRAFT 是 schema 里的默认值，但 [ItemService.create](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/item/item.service.ts#L32-L57) 直接写成 ACTIVE，DRAFT 状态在业务中从未真正出现。

---

## 三、出售订单链路（Order → Item.type = SELL）

所有状态修改入口在 [order.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts)。

### 3.1 创建订单 — [OrderService.create](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts#L41-L99)

**触发者**：买家
**前置校验**（非事务内完成）：
1. 物品存在
2. `item.status === ACTIVE`
3. `item.userId !== buyerId`（不能买自己的）
4. `item.type === 'SELL'`

**事务内副作用**：
1. 创建订单，`order.status = PENDING`
2. 更新物品：`item.status = RESERVED`

### 3.2 卖家确认订单 — [OrderService.confirm](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts#L148-L169)

**触发者**：卖家
**前置校验**：
1. 订单存在，当前用户是卖家
2. `order.status === PENDING`

**副作用**：仅更新 `order.status = CONFIRMED`，**不触碰 item.status**（物品保持 RESERVED）。

### 3.3 买家确认收货 — [OrderService.complete](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts#L177-L215)

**触发者**：买家
**前置校验**：
1. 订单存在，当前用户是买家
2. `order.status === CONFIRMED`

**事务内副作用**：
1. `order.status = COMPLETED`
2. `item.status = SOLD`
3. `seller.creditScore += 5`

### 3.4 取消订单 — [OrderService.cancel](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts#L223-L260)

**触发者**：买家或卖家
**前置校验**：
1. 订单存在，当前用户是买卖双方之一
2. `order.status ∈ {PENDING, CONFIRMED}`

**事务内副作用**：
1. `order.status = CANCELLED`
2. **直接将 `item.status = ACTIVE`**（无 WHERE 条件、不校验当前 item.status、不检查是否有其他订单/互换占用）

---

## 四、互换链路（Exchange → Item.type = EXCHANGE）

所有状态修改入口在 [exchange.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts)。互换涉及**两个物品**：`requesterItem`（请求方提供）和 `ownerItem`（对方物品）。

### 4.1 发起互换请求 — [ExchangeService.create](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts#L28-L102)

**触发者**：请求者（requester）
**前置校验**：
1. `ownerItem` 存在，`ownerItem.status === ACTIVE`，`ownerItem.type === EXCHANGE`
2. `ownerItem.userId !== requesterId`
3. `requesterItem` 存在，属于 requester，**`requesterItem.status === ACTIVE`**
4. 不存在相同 requester+ownerItem 的 PENDING/ACCEPTED 请求（只对 requester 维度去重，不对 ownerItem 维度去重）

**副作用**：
1. 创建 `exchange.status = PENDING`
2. **不修改任何物品状态！** 两个物品都保持 ACTIVE。

> 🔴 这是两条链路最不对称的一点：订单创建时立即锁物品，互换创建时**不锁**，直到 accept 才锁。

### 4.2 接受互换 — [ExchangeService.accept](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts#L156-L188)

**触发者**：物品主人（owner）
**前置校验**：
1. 互换存在，当前用户是 owner
2. `exchange.status === PENDING`

**事务内副作用**：
1. `exchange.status = ACCEPTED`
2. `updateMany` 将 requesterItemId、ownerItemId **两个物品**都设为 `RESERVED`
   - **没有 WHERE status = ACTIVE 条件**，盲目覆盖
   - **没有把其他针对这两件物品的 PENDING 互换请求批量拒绝**

### 4.3 拒绝互换 — [ExchangeService.reject](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts#L196-L217)

**触发者**：owner
**前置校验**：`exchange.status === PENDING`
**副作用**：仅 `exchange.status = REJECTED`，不触碰物品状态（合理，因为 PENDING 阶段物品根本没被锁）。

> ⚠️ 代码中**没有"取消已接受互换"的接口**。一旦 ACCEPTED，只能走 complete（双方变 SOLD），没有后悔路径。

### 4.4 确认互换完成 — [ExchangeService.complete](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts#L226-L265)

**触发者**：requester **或** owner 任意一方
**前置校验**：
1. 互换存在，当前用户是双方之一
2. `exchange.status === ACCEPTED`

**事务内副作用**：
1. `exchange.status = COMPLETED`
2. 两个物品都 updateMany 为 `SOLD`
3. 双方用户 `creditScore += 5`

> 🔴 注释说"需要双方都确认才能完成"，但代码实现是**单方调用即完成**，双边确认机制不存在。

---

## 五、物品自身服务的干预点（item.service.ts）

| 方法 | 触发者 | 对状态的影响 | 备注 |
|------|--------|-------------|------|
| [create](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/item/item.service.ts#L32-L57) | 发布者 | → ACTIVE | 覆盖 schema 默认 DRAFT |
| [update](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/item/item.service.ts#L215-L248) | 发布者 | 不直接改 status | **不校验当前状态**，RESERVED/SOLD 状态下仍可改 type/price 等 |
| [remove](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/item/item.service.ts#L256-L286) | 发布者 | 物理删除 | 只检查 PENDING/CONFIRMED 订单，**不检查互换** |
| [offShelf](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/item/item.service.ts#L294-L311) | 发布者 | → OFF_SHELF | **不校验当前状态**，RESERVED 时也能下架 |
| [onShelf](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/item/item.service.ts#L319-L340) | 发布者 | → ACTIVE | 仅要求当前是 OFF_SHELF，**不管是否有订单/互换正在进行** |

---

## 六、两条链路是否会冲突？答案是会，而且路径很多。

设计上 `Item.type`（SELL / EXCHANGE）试图把物品切成两个互斥集合：SELL 物品只走订单，EXCHANGE 物品只走互换。但实际代码层面并没有形成真正的隔离：

1. **互换时只校验了 ownerItem.type === EXCHANGE**，完全**没有校验 requesterItem.type**。一个 SELL 类型的在售物品可以作为 requesterItem 去参与互换，且互换 create 阶段不锁物品，等于该物品同时在两条链路中流转。
2. 所有 `item.update` 都**没有附带状态前置条件**（没有 `WHERE status = ?`），属于典型的"读-校验-写"分离，没有乐观锁（version 字段），也没有 `SELECT ... FOR UPDATE` 悲观锁。
3. [OrderService.cancel](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts#L253-L255) 和 [ExchangeService.accept](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts#L181-L184) 都是无条件 SET status，后写入者无条件覆盖前写入者。
4. `item.remove / offShelf / onShelf / update` 对 RESERVED/SOLD 状态的物品都缺乏防护。

---

## 七、并发 & 边界场景的坑（≥2 个）

### 🔴 坑 1：并发下单导致"一单多卖"（经典 TOCTOU 竞态）

**位置**：[OrderService.create L45-L93](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts#L45-L93)

**时序**：
```
t0: item.status = ACTIVE
t1: 买家A请求下单 → prisma.item.findUnique() 读到 ACTIVE ✅ 通过校验
t2: 买家B请求下单 → prisma.item.findUnique() 也读到 ACTIVE ✅ 通过校验
t3: A的事务开始 → 创建订单A → UPDATE item SET status=RESERVED
t4: B的事务开始 → 创建订单B → UPDATE item SET status=RESERVED（再次写入成功）
结果：同一个物品上出现了两个 PENDING 订单，物品状态是 RESERVED。
```

**根本原因**：状态检查（在事务外 `findUnique`）和状态更新（在事务内 `update`）不是一个原子操作。Prisma 这里默认是 MySQL InnoDB 的默认隔离级别（REPEATABLE READ），事务内的 UPDATE 只会做行锁，但由于"校验发生在事务开始之前"，两个并发请求都会通过 ACTIVE 校验，然后串行进入事务各创建一个订单。

**后果**：卖家会看到两个待确认订单；取消其中任何一个都会把 item.status 无脑改回 ACTIVE（见坑 2），留下另一个订单在 CONFIRMED 过程中，最终可能触发两次 complete → 两次给卖家加信用分，物品被"SOLD"两次。

**修复方向**：把 `findUnique` 搬进事务并用 `prisma.$transaction([...])` 的串行隔离或使用 `SELECT ... FOR UPDATE`（`prisma.$queryRaw` 加锁）；更轻量的方式是把 UPDATE 改成 `UPDATE item SET status=RESERVED WHERE id=? AND status=ACTIVE`，然后检查 affectedRows === 1，否则回滚报错"物品已被预订"。

---

### 🔴 坑 2：订单取消无脑回写 ACTIVE，无视互换/其他占用

**位置**：[OrderService.cancel L253-L255](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/order/order.service.ts#L253-L255)

```ts
await prisma.item.update({
  where: { id: order.itemId },
  data: { status: ItemStatus.ACTIVE },
});
```

**时序（与互换的交叉）**：
```
1. 物品X type=SELL，正常被下单 → item.status = RESERVED（订单A）
2. 由于坑1，或者历史脏数据，物品X上同时存在一个已 ACCEPTED 的互换E
   （更常见的情况：物品是 requesterItem，因 ExchangeService.accept 把双边都锁成 RESERVED）
3. 订单A被取消 → cancel() 直接把 itemX 设为 ACTIVE
4. 此时互换E还在 ACCEPTED 状态，但物品X已经被打回 ACTIVE，可以被再次下单/被其他互换请求接受
5. 互换E随后调用 complete() → 又把 itemX 设为 SOLD
结果：一个物品同时出现"已取消的订单A"和"已完成的互换E"，买家付了钱但东西被换走了。
```

**更简单的复现**：卖家在订单 PENDING 期间调用 `offShelf`（item.offShelf 不校验状态），物品变 OFF_SHELF；之后买家取消订单 → cancel 把物品硬改成 ACTIVE，卖家的下架操作被悄无声息地覆盖。

**根本原因**：`cancel()` 没有做任何"当前物品状态应该是什么"的判断，直接硬编码 SET ACTIVE。正确逻辑应该是：取消前先查是否还有其他进行中的（PENDING/CONFIRMED）订单或 ACCEPTED 的互换，只有当这是最后一个占用者时才恢复为 ACTIVE；如果是被 offShelf 的还要尊重用户的下架意图。

---

### 🟠 坑 3（额外）：互换 PENDING 阶段物品无锁，accept 盲目覆盖

**位置**：[ExchangeService.create L84-L99](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts#L84-L99) 和 [ExchangeService.accept L181-L184](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts#L181-L184)

**时序**：
```
1. 物品X(EXCHANGE) 上架，A、B、C 三个人分别对 X 发起互换请求（都通过 ACTIVE 校验）
   → 此时有三条 PENDING 互换记录，物品X仍是 ACTIVE
2. 物品X的主人还看到物品是 ACTIVE，正常又把它下架（offShelf → OFF_SHELF）
3. 主人没有刷新，点了接受A的互换 → accept() 进入事务
   - 只检查 exchange.status === PENDING
   - 直接 UPDATE item SET status=RESERVED（覆盖 OFF_SHELF，下架被无视）
4. 同时 B 看到自己之前发起的还是 PENDING，主人也可以再点接受 B 的互换 →
   accept(B) 也只检查 exchange.status === PENDING，把两个物品再 SET RESERVED（第二次覆盖）
   → 两条 ACCEPTED 互换，四件物品被锁死，完全无法完成。
```

**问题叠加**：
- accept 内 `updateMany` 不带 `WHERE status = ACTIVE`，任何当前状态都会被覆盖（OFF_SHELF、甚至 SOLD 都能被覆盖成 RESERVED）。
- 接受一个互换请求后，其他挂起的 PENDING 请求不会被自动标记为 REJECTED，用户界面上还能看到"待响应"。
- 没有"取消已接受互换"的接口，一旦两条 ACCEPTED 并存，就成了死局。

---

### 🟠 坑 4（额外）：互换 complete 单方确认即可完成

**位置**：[ExchangeService.complete L226-L265](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-earth/src/modules/exchange/exchange.service.ts#L226-L265)

注释写"需要双方都确认才能完成"，但实现里 `if (exchange.requesterId !== userId && exchange.ownerId !== userId)` 只是判断是参与者即可，任意一方点一次就直接把两边物品都置为 SOLD 并加信用分。恶意一方可以在对方还没线下见面就点击完成，强制造就交易终态。

---

## 八、副作用清单（按状态转换汇总）

| 触发动作 | OrderStatus 变更 | ExchangeStatus 变更 | ItemStatus 变更 | 其他副作用 | 事务？ |
|---------|-----------------|---------------------|----------------|-----------|-------|
| Order.create | → PENDING | - | ownerItem → RESERVED | 生成 orderNo | ✅ 事务 |
| Order.confirm | PENDING → CONFIRMED | - | 不变 | - | ❌ 单写 |
| Order.complete | CONFIRMED → COMPLETED | - | item → SOLD | seller 信用分 +5 | ✅ 事务 |
| Order.cancel | PENDING/CONFIRMED → CANCELLED | - | **item → ACTIVE（硬覆盖）** | - | ✅ 事务 |
| Exchange.create | - | → PENDING | **不变（不锁）** | - | ❌ 单写 |
| Exchange.accept | - | PENDING → ACCEPTED | **双方 item → RESERVED（硬覆盖）** | - | ✅ 事务 |
| Exchange.reject | - | PENDING → REJECTED | 不变 | - | ❌ 单写 |
| Exchange.complete | - | ACCEPTED → COMPLETED | **双方 item → SOLD（硬覆盖）** | 双方信用分 +5 | ✅ 事务 |
| Item.create | - | - | → ACTIVE | - | ❌ |
| Item.offShelf | - | - | （任意状态）→ OFF_SHELF | - | ❌ 不校验 |
| Item.onShelf | - | - | OFF_SHELF → ACTIVE | - | ❌ 不校验占用 |
| Item.remove | - | - | 物理删除 | - | ❌ 只查订单不查互换 |

---

## 九、一句话总结

系统通过 `Item.type` 在**设计意图**上隔离了出售/互换两条链路，但在**代码实现**上：
- 订单链路是"先锁后谈"（create 即 RESERVED），
- 互换链路是"先谈后锁"（accept 才 RESERVED），
- 加上所有 `item.status` 写入都是无前置条件的硬覆盖、没有乐观/悲观锁、取消/下架/上架操作不检查占用，导致两条链路的写入会在 RESERVED/ACTIVE/SOLD/OFF_SHELF 之间相互踩踏，在并发下必然出现超卖、状态被意外复活、下架失效、互换死锁等问题。
