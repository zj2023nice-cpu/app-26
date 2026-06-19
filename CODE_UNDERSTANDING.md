# 物品状态机深度分析：订单链路 × 互换链路

> 分析范围：[prisma/schema.prisma](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/prisma/schema.prisma)、[item.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/item/item.service.ts)、[order.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/order/order.service.ts)、[exchange.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts)

---

## 1. 核心枚举与数据关系

### 1.1 物品状态（ItemStatus）

| 状态 | 含义 | 列表可见性 |
|------|------|-----------|
| `DRAFT` | 草稿 | 不可见（代码中未实际使用，创建直接 ACTIVE） |
| `ACTIVE` | 上架中 | 可见，可被下单/互换 |
| `RESERVED` | 已预订 | 不可见（findAll 只查 ACTIVE），交易进行中 |
| `SOLD` | 已售出 | 不可见，交易闭环 |
| `OFF_SHELF` | 已下架 | 不可见，用户主动下架 |

### 1.2 物品类型（ItemType）与交易链路的对应

| ItemType | 允许的交易 |
|----------|-----------|
| `SELL` | 可被创建订单（OrderService.create 校验 `item.type === 'SELL'`） |
| `EXCHANGE` | 可作为 ownerItem 被发起互换（ExchangeService.create 校验 `ownerItem.type === EXCHANGE`） |

**重要发现**：requesterItem（发起方用于交换的物品）**没有 type 校验**。这意味着一个 `SELL` 类型的物品可以作为 requesterItem 参与互换，从而同时被订单链路和互换链路操作——这正是用户感到混乱的根源。

### 1.3 订单状态（OrderStatus）与互换状态（ExchangeStatus）

- **订单**：`PENDING`（待卖家确认）→ `CONFIRMED`（卖家已确认，待线下交易）→ `COMPLETED`（买家确认收货）
- **订单取消**：`PENDING` / `CONFIRMED` → `CANCELLED`
- **互换**：`PENDING`（待响应）→ `ACCEPTED`（对方已接受，待线下交换）→ `COMPLETED`（确认互换完成）
- **互换拒绝**：`PENDING` → `REJECTED`
- **互换缺失**：ACCEPTED 之后**没有取消/回退路径**，只有 complete。

---

## 2. 出售订单链路：状态转换全拆解

### 2.1 状态转换图（订单维度）

```
买家下单(P)          卖家确认(P)          买家收货(P)
  ACTIVE ──────────→ RESERVED ──────────→ RESERVED ──────────→ SOLD
  (创建PENDING订单)   (订单→CONFIRMED)   (订单→COMPLETED, 信用分+5)
     │                    │                    │
     │    买家/卖家取消    │    买家/卖家取消    │
     └────────────────────┴────────────────────┘
                        ↓
                     ACTIVE
                   (订单→CANCELLED)
```

> (P) = Prisma 事务保护

### 2.2 每个触发点的详细逻辑

#### ① 买家下单 — `POST /api/orders` → [OrderService.create](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/order/order.service.ts#L41-L99)

| 项目 | 详情 |
|------|------|
| **触发者** | 买家（buyerId ≠ item.userId） |
| **事务外校验** | 物品存在；`item.status === ACTIVE`；不能买自己的物品；`item.type === 'SELL'` |
| **事务内操作** | 创建 Order(status=PENDING) → 更新 Item(status=RESERVED) |
| **副作用** | 无消息通知、无信用分变化 |
| **⚠️ 风险点** | 所有校验在事务外执行（check-then-act），存在竞态窗口 |

#### ② 卖家确认订单 — `POST /api/orders/:id/confirm` → [OrderService.confirm](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/order/order.service.ts#L148-L169)

| 项目 | 详情 |
|------|------|
| **触发者** | 卖家（order.sellerId） |
| **校验** | 订单存在；当前用户是卖家；`order.status === PENDING` |
| **操作** | 更新 Order(status=CONFIRMED) |
| **物品状态** | **不变**（保持 RESERVED） |
| **副作用** | 无 |

#### ③ 买家确认收货（完成订单） — `POST /api/orders/:id/complete` → [OrderService.complete](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/order/order.service.ts#L177-L215)

| 项目 | 详情 |
|------|------|
| **触发者** | 买家（order.buyerId） |
| **校验** | 订单存在；当前用户是买家；`order.status === CONFIRMED` |
| **事务内操作** | Order→COMPLETED → Item(status=SOLD) → 卖家 creditScore+5 |
| **副作用** | 卖家信用分+5 |

#### ④ 取消订单 — `POST /api/orders/:id/cancel` → [OrderService.cancel](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/order/order.service.ts#L223-L260)

| 项目 | 详情 |
|------|------|
| **触发者** | 买家或卖家 |
| **校验** | 订单存在；当前用户是买家或卖家；`order.status ∈ {PENDING, CONFIRMED}` |
| **事务内操作** | Order→CANCELLED → Item(status=ACTIVE) |
| **⚠️ 风险点** | **直接将物品恢复为 ACTIVE，不检查是否还有其他进行中交易** |

---

## 3. 互换请求链路：状态转换全拆解

### 3.1 状态转换图（互换维度）

```
发起互换(P)         对方接受(P)              任意一方确认(P)
  ACTIVE ──────────→ ACTIVE ──────────────→ RESERVED ──────────────→ SOLD
  (创建PENDING互换)  (互换→ACCEPTED)        (双方物品→RESERVED)      (双方物品→SOLD, 双方信用分+5)
     │                  │                      │
     │    对方拒绝       │                      │
     └──────────────────┘                      │  (无取消API!)
           ↓                                   │
        REJECTED                          无法回退
      (物品状态不变)
```

> (P) = Prisma 事务保护。注意：发起互换时**不改变物品状态**，只有 accept 才加 RESERVED 锁。

### 3.2 每个触发点的详细逻辑

#### ① 发起互换请求 — `POST /api/exchanges` → [ExchangeService.create](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts#L28-L102)

| 项目 | 详情 |
|------|------|
| **触发者** | 请求者（requesterId ≠ ownerItem.userId） |
| **事务外校验** | ownerItem 存在且 `status===ACTIVE` 且 `type===EXCHANGE`；requesterItem 存在且属于自己且 `status===ACTIVE`；**同一请求者对同一目标物品无 PENDING/ACCEPTED 互换** |
| **操作** | 创建 Exchange(status=PENDING)，**不修改任何物品状态** |
| **⚠️ 关键缺陷** | 不锁定物品！发起互换后物品仍为 ACTIVE，其他人可继续下单或发起互换 |
| **⚠️ 关键缺陷** | requesterItem.type **未校验**，SELL 类型物品可作为交换筹码 |
| **⚠️ 关键缺陷** | 只防"同一请求者重复请求"，不防"不同请求者对同一物品发起多个互换" |

#### ② 接受互换 — `POST /api/exchanges/:id/accept` → [ExchangeService.accept](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts#L156-L188)

| 项目 | 详情 |
|------|------|
| **触发者** | 物品主人（exchange.ownerId） |
| **事务外校验** | 互换存在；当前用户是 owner；`exchange.status === PENDING` |
| **事务内操作** | Exchange→ACCEPTED → **双方物品** status=RESERVED（updateMany） |
| **⚠️ 风险点** | updateMany **没有 status 过滤条件**，即不管物品当前是 ACTIVE/RESERVED/SOLD，一律覆盖为 RESERVED |
| **⚠️ 风险点** | 事务内未重新校验两个物品是否仍为 ACTIVE，可能把已售出/已预订的物品"拉回"RESERVED |
| **⚠️ 风险点** | 未同时拒绝/取消其他对同一物品的 PENDING 互换请求，孤儿请求残留 |

#### ③ 拒绝互换 — `POST /api/exchanges/:id/reject` → [ExchangeService.reject](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts#L196-L217)

| 项目 | 详情 |
|------|------|
| **触发者** | 物品主人 |
| **校验** | 互换存在；当前用户是 owner；`exchange.status === PENDING` |
| **操作** | Exchange→REJECTED |
| **物品状态** | 不变（因为 create 时就没锁定，所以不需要恢复） |

#### ④ 确认互换完成 — `POST /api/exchanges/:id/complete` → [ExchangeService.complete](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts#L226-L265)

| 项目 | 详情 |
|------|------|
| **触发者** | 请求者或主人（**任意一方即可**） |
| **校验** | 互换存在；当前用户是 requester 或 owner；`exchange.status === ACCEPTED` |
| **事务内操作** | Exchange→COMPLETED → **双方物品** status=SOLD → 双方 creditScore+5 |
| **⚠️ 风险点** | 注释说"需要双方都确认"，但代码实现为**单方确认即完成** |

---

## 4. 物品生命周期总状态转换图

```
                          ┌─────────────────────────────────────┐
                          │              DRAFT                   │
                          │  (schema默认值,代码中创建即覆盖为ACTIVE) │
                          └──────────────┬──────────────────────┘
                                         │ create()
                                         ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                        ACTIVE（上架中）                      │
        │  ┌───────────────────────────────────────────────────────┐  │
        │  │ 仅 ACTIVE 状态出现在公开列表(findAll where status=ACTIVE)│  │
        │  └───────────────────────────────────────────────────────┘  │
        └─────┬──────────────┬──────────────┬──────────────┬──────────┘
              │              │              │              │
   offShelf() │   order      │  exchange    │  item.update │  (无校验,任意状态可调用)
   (无状态    │   .create()  │  .create()   │  可改type等  │
    校验!)    │   (事务)     │  (不锁物品!) │              │
              ▼              ▼              ▼              ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │  OFF_SHELF   │ │  RESERVED    │ │  (仍为ACTIVE) │ │  (状态不变但  │
     │  (已下架)    │ │  (已预订)    │ │  互换请求存在  │ │  type被改变)  │
     └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────────────┘
            │                │                │
   onShelf() │   ┌────────────┴────────────┐  │ owner接受互换
   (校验必须  │   │                         │  │ (事务!)
   OFF_SHELF) │   │                         ▼  ▼
            │   │                 ┌──────────────────┐
            ▼   │                 │    RESERVED      │◄──── 交叉污染点!
       ACTIVE   │                 │  (互换已接受)    │      accept不校验
      (恢复)    │                 └───────┬──────────┘      物品原状态
               │                         │
               │          ┌──────────────┼──────────────┐
               │          │              │              │
               │  order   │  order       │  exchange    │
               │  .cancel │  .complete() │  .complete() │
               │  (事务)  │  (事务)      │  (事务)      │
               │          │              │              │
               │          ▼              ▼              ▼
               │    ┌──────────┐   ┌──────────┐   ┌──────────┐
               │    │ ACTIVE   │   │  SOLD    │   │  SOLD    │
               │    │ (恢复)   │   │ (已售出) │   │ (已售出) │
               │    └──────────┘   └──────────┘   └──────────┘
               │         ▲              │              │
               │         │   无任何操作可从SOLD恢复(终态) │
               └─────────┴──────────────┴──────────────┘
                   (cancel直接恢复ACTIVE,
                    不检查其他进行中交易)
```

### 4.1 物品自身操作对状态的影响（ItemService）

| 操作 | API | 前置校验 | 目标状态 |
|------|-----|---------|---------|
| 发布物品 | `POST /items` | 分类存在 | 直接 ACTIVE（DRAFT 被覆盖） |
| 下架 | `POST /items/:id/off-shelf` | 仅校验物品归属 | **任意状态→OFF_SHELF（无状态校验！）** |
| 重新上架 | `POST /items/:id/on-shelf` | 物品归属 + 当前状态必须是 OFF_SHELF | OFF_SHELF→ACTIVE |
| 删除 | `DELETE /items/:id` | 物品归属 + 无 PENDING/CONFIRMED 订单 | 物理删除 |
| 更新 | `PATCH /items/:id` | 仅校验物品归属 | 不改状态，但**可改 type/price 等关键字段，即使在 RESERVED/SOLD 状态** |

**ItemService 遗漏的校验**：
- [offShelf](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/item/item.service.ts#L294-L311)：不检查物品是否有进行中订单/互换，RESERVED 的物品可以被下架
- [remove](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/item/item.service.ts#L256-L286)：只检查订单，**不检查互换请求**，有 ACCEPTED 互换的物品可以被删除
- [update](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/item/item.service.ts#L215-L248)：不检查状态，RESERVED/SOLD 的物品仍可被修改 type、price 等

---

## 5. 两条链路的交叉影响分析

### 5.1 交叉点：SELL 物品作为 requesterItem 参与互换

尽管 type 字段在语义上区分 SELL 和 EXCHANGE，但代码只限制了**被请求方物品**（ownerItem）必须是 EXCHANGE 类型，对**请求方物品**（requesterItem）无 type 校验。这导致以下交叉场景成为可能：

```
用户A发布SELL物品X (ACTIVE) ──────┬──→ 买家C对X下单(order.create) ──→ X:RESERVED
                                  │
                                  └──→ 用户B用X作为requesterItem去换
                                       用户D的EXCHANGE物品Y(exchange.create)
                                       ──→ X:ACTIVE（互换PENDING期间不锁物品！）
```

在这个场景中：
1. X 的状态可能先被订单设为 RESERVED
2. 互换的 accept 如果随后发生，[exchange.accept 第181-184行](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts#L181-L184) 会无条件把 X 更新为 RESERVED（值虽然相同，但语义上 X 已经有一个订单了）
3. 如果订单 cancel，[order.cancel 第253-255行](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/order/order.service.ts#L253-L255) 直接把 X 恢复为 ACTIVE，**但互换已经 ACCEPTED，X 应该保持 RESERVED**
4. 如果互换 complete，X 被设为 SOLD；如果订单也 complete，X 被再次设为 SOLD——但存在两个交易都声称完成的"双重售卖"

### 5.2 交叉点：offShelf 在交易进行中被调用

卖家可以在物品 RESERVED 状态时调用 offShelf：
1. 物品状态从 RESERVED → OFF_SHELF
2. 买家随后 cancel 订单 → 物品状态被强制从 OFF_SHELF → ACTIVE（覆盖了卖家的下架操作）
3. 结果：卖家以为已下架，实际已被恢复为上架

### 5.3 交叉点：同一物品多个 PENDING 互换请求

exchange.create 只防止"同一请求者重复请求"，不限制不同请求者。一个 EXCHANGE 物品可以同时收到多个互换请求（全部为 PENDING）。当 owner accept 其中一个时：
1. 两个物品被设为 RESERVED
2. 其他 PENDING 互换请求**不会自动被拒绝**，变成孤儿请求
3. 其他请求的 requester 可能已经看到自己的物品被锁定（RESERVED），但互换请求一直挂着

---

## 6. 并发与边界场景下的坑（至少 2 个）

### 🔴 坑 1：Check-Then-Act 竞态条件导致"一单多卖"（高危）

**位置**：[OrderService.create](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/order/order.service.ts#L41-L99) 第 55 行校验与第 70 行事务之间

**问题本质**：
所有状态校验（`item.status !== ItemStatus.ACTIVE`）都在 `$transaction` **外部**执行。在高并发下，两个买家的请求可以同时通过 ACTIVE 检查，然后各自进入事务创建订单。

**时序复现**：
```
时间线   买家A的请求                          买家B的请求
─────────────────────────────────────────────────────────────────
T1       读取item, status=ACTIVE ✓
T2                                          读取item, status=ACTIVE ✓
T3       开启事务
T4       INSERT order (PENDING)
T5       UPDATE item→RESERVED
T6       提交事务 → 成功
T7                                          开启事务
T8                                          INSERT order (PENDING) ← 第二个订单!
T9                                          UPDATE item→RESERVED（覆盖写入，影响0行但不报错）
T10                                         提交事务 → 也成功!
```

**结果**：同一个物品产生两个 PENDING 状态的订单。两个买家都认为自己"抢到了"。无论后续谁先 confirm/complete，cancel 方都会因为直接恢复 ACTIVE 而引入更多混乱。

**同样问题存在于**：
- [ExchangeService.accept](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts#L156-L188)：事务外检查 `exchange.status === PENDING`，事务内直接 updateMany 为 RESERVED，不做 `WHERE status = ACTIVE` 的乐观锁校验。
- [ExchangeService.create](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts#L28-L102)：虽然 create 本身不改状态，但它和 order.create 之间对同一物品的 ACTIVE 检查也存在竞态。

**修复方向**：
- 将状态校验放入事务内，使用 `SELECT ... FOR UPDATE`（Prisma 中通过 `$transaction` 配合 `findUnique` 并在 update 时使用条件 where 实现乐观锁）
- 更新物品状态时使用条件更新：`prisma.item.update({ where: { id, status: ItemStatus.ACTIVE }, data: { status: RESERVED } })`，然后检查 `count` 是否为 1，不为 1 则说明状态已变，抛错回滚

---

### 🔴 坑 2：Cancel/Reject 的状态恢复不做引用检查，导致"被锁的物品被意外解锁"

**位置**：[OrderService.cancel](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/order/order.service.ts#L253-L255)

**问题本质**：
取消订单时，代码**无条件**将物品状态恢复为 ACTIVE，不检查该物品是否还被其他进行中的交易（其他订单、ACCEPTED 的互换）引用。

**场景 A：同一物品多个订单（坑 1 的后果放大）**
```
1. 并发导致物品X有两个PENDING订单 OrderA、OrderB（坑1）, X:RESERVED
2. 买家A取消OrderA → X被恢复为ACTIVE
3. 此时X是ACTIVE状态，第三个买家C可以直接下单创建OrderC
4. 买家B确认OrderB并收货 → X被设为SOLD
5. 结果：OrderC 创建在 X 恢复 ACTIVE 的窗口期，又指向一个即将被 SOLD 的物品
```

**场景 B：SELL 物品同时参与互换（requesterItem 无 type 校验）**
```
1. 用户A的SELL物品X:ACTIVE
2. 用户B用X作为requesterItem发起对Y的互换（exchange.create），X仍为ACTIVE
3. 用户C对X下单（order.create）→ X:RESERVED, OrderC:PENDING
4. 用户D(Y的主人)接受互换 → exchange.accept事务内updateMany把X和Y都设为RESERVED（X已经是RESERVED，被覆盖为RESERVED，值不变但新增了一个ACCEPTED互换引用）
5. 用户C取消OrderC → order.cancel直接把X恢复为ACTIVE
6. 结果：互换是ACCEPTED状态，但X已经变成ACTIVE了！其他人可以继续对X下单，互换双方中用户B的筹码物品X已经"自由"了
```

**场景 C：offShelf 被 cancel 覆盖**
```
1. 买家下单 → X:RESERVED
2. 卖家（出于某些原因）调用 offShelf → X:OFF_SHELF（offShelf不校验状态！）
3. 买家取消订单 → X:ACTIVE（覆盖了OFF_SHELF）
4. 结果：卖家以为已下架，物品实际已重新上架可被购买
```

**修复方向**：
- cancel 时在事务内查询：是否还有其他 PENDING/CONFIRMED 的订单、ACCEPTED 的互换引用此物品。只有当所有进行中交易都不存在时，才恢复为 ACTIVE；否则保持 RESERVED。
- 或者更稳健地：在物品表增加一个"锁定引用计数"或"当前交易ID"字段，用引用计数管理状态恢复。

---

### 🟡 坑 3（补充）：互换 ACCEPTED 后无法取消，存在死锁

**位置**：[ExchangeService](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts) 整体

**问题**：
互换状态机中，PENDING 可以被 reject，但 ACCEPTED 之后只有 complete 一条出路，没有 cancel 操作。如果双方线下见面后发现物品不合心意、一方爽约等，没有任何机制可以：
- 将互换状态标记为取消
- 将双方物品从 RESERVED 恢复为 ACTIVE

这意味着一旦 accept，两个物品就"死锁"在 RESERVED 状态，除非双方一致同意完成（complete→SOLD）。如果一方拒绝配合，物品将永远卡在 RESERVED（无法被其他人购买/互换，也无法被下架后重新上架——因为 onShelf 要求当前状态是 OFF_SHELF，而物品是 RESERVED）。

等等，让我再确认一下：offShelf 无状态校验，所以卖家可以对 RESERVED 的物品调用 offShelf → OFF_SHELF，然后 onShelf → ACTIVE。这相当于一个"后门"来绕过 RESERVED 状态，但这又回到了坑 2——如果此时订单 cancel 或互换 complete，会再次覆盖状态。

---

### 🟡 坑 4（补充）：互换 Complete 单方即可完成，违反"双方确认"语义

**位置**：[ExchangeService.complete](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-saturn/src/modules/exchange/exchange.service.ts#L226-L265)

**问题**：
注释明确写"需要双方都确认才能完成"，但代码实现为任意一方调用即可 complete 并将两个物品都设为 SOLD。恶意一方可以在对方未同意线下交换完成时，单方调用 complete 直接"完成"交易，将对方物品标记为 SOLD。虽然信用分+5，但物品归属在数据库层面已经不可逆（没有从 SOLD 恢复的路径）。

---

## 7. 总结：两条链路的状态写入者清单

下表列出所有可能修改 Item.status 的代码位置，以及它们写入的条件：

| # | 方法 | 文件 | 行号 | 写入目标状态 | 是否事务内 | 写入前校验物品状态 | 条件更新(WHERE status=?) |
|---|------|------|------|-------------|-----------|------------------|------------------------|
| 1 | create | item.service.ts | L43-L49 | ACTIVE | 否(单次create) | 无(新建) | N/A |
| 2 | offShelf | item.service.ts | L307-L309 | OFF_SHELF | 否 | **无** | ❌ 无 |
| 3 | onShelf | item.service.ts | L336-L339 | ACTIVE | 否 | 校验==OFF_SHELF | ❌ 无(用findUnique先查) |
| 4 | order.create | order.service.ts | L90-L93 | RESERVED | **是** | 事务外校验==ACTIVE | ❌ 无(直接按id更新) |
| 5 | order.complete | order.service.ts | L202-L205 | SOLD | **是** | 校验订单状态 | ❌ 无(直接按id更新) |
| 6 | order.cancel | order.service.ts | L253-L255 | ACTIVE | **是** | 校验订单状态 | ❌ 无(直接按id更新) |
| 7 | exchange.accept | exchange.service.ts | L181-L184 | RESERVED | **是** | 事务外校验互换状态 | ❌ 无(updateMany，无status过滤) |
| 8 | exchange.complete | exchange.service.ts | L252-L254 | SOLD | **是** | 校验互换状态 | ❌ 无(updateMany，无status过滤) |

**核心结论**：8 处状态写入中，**0 处使用了条件更新（乐观锁）** 来保证状态转换的原子性。事务只能保证"订单和物品的写入要么都成功要么都失败"，但不能防止"两个并发事务都通过了前置检查、都认为自己可以合法写入"的竞态问题。这是所有并发坑的根源。
