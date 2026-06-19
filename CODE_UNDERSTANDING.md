# 物品状态机梳理：出售订单 / 互换请求双链路

> 目标：把 `Item.status` 在「出售订单」和「互换请求」两条业务链路下的所有触发点、校验、副作用以及潜在冲突彻底说清。
> 仅基于以下代码进行静态分析，不修改任何业务代码：
> - [schema.prisma](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/prisma/schema.prisma)
> - [item.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts)
> - [order.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts)
> - [exchange.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts)

---

## 1. 状态/类型枚举

来自 [schema.prisma#L22-L50](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/prisma/schema.prisma#L22-L50)：

| 枚举 | 值 |
|---|---|
| `ItemType` | `SELL`、`EXCHANGE` |
| `ItemStatus` | `DRAFT`、`ACTIVE`、`RESERVED`、`SOLD`、`OFF_SHELF` |
| `OrderStatus` | `PENDING`、`CONFIRMED`、`COMPLETED`、`CANCELLED` |
| `ExchangeStatus` | `PENDING`、`ACCEPTED`、`REJECTED`、`COMPLETED` |

> ⚠️ 数据库层面 `Item.status` 没有任何 DB 级互斥约束（无唯一索引、无乐观锁字段如 `version`），所有"占用"语义都依赖应用层在事务内的"先读后写"。

---

## 2. 物品状态转换图（合并两条链路）

```
                 ┌──────────────────────────────────────────────────────┐
                 │                      DRAFT                           │
                 │  （schema 默认值，但 ItemService.create 实际写入       │
                 │   ACTIVE，未发现把状态置为 DRAFT 的代码路径）          │
                 └──────────────────────────────────────────────────────┘

  user.create(item)
        │  status = ACTIVE  (item.service.ts: create)
        ▼
   ┌──────────┐  offShelf            ┌──────────────┐
   │  ACTIVE  │ ───────────────────▶ │   OFF_SHELF  │
   │ (上架中) │ ◀─────────────────── │  (已下架)    │
   └──────────┘     onShelf          └──────────────┘
        │  ▲
        │  │ order.cancel (订单链路 - 取消时回滚到 ACTIVE)
        │  │ ※ 互换链路无回滚分支
        │  │
        │  │
        │  ▼
        │  [ 订单链路：order.create ]
        │      校验 item.status == ACTIVE && item.type == SELL
        │      事务内：创建 Order(PENDING) + Item.status = RESERVED
        │
        │  [ 互换链路：exchange.accept ]
        │      校验 exchange.status == PENDING
        │      事务内：Exchange.status = ACCEPTED
        │      + updateMany([requesterItemId, ownerItemId]).status = RESERVED
        │      ⚠️ 这里只校验了 Exchange 状态，没有再校验两件物品当前的 ItemStatus
        │
        ▼
   ┌──────────┐
   │ RESERVED │  (已预订)
   │          │
   └──────────┘
        │
        │ order.complete  → 事务内 Order=COMPLETED + Item.status = SOLD
        │ exchange.complete → 事务内 Exchange=COMPLETED + 双方 Item.status = SOLD
        │
        ▼
   ┌──────────┐
   │   SOLD   │  (已售出，终态，无任何代码路径回滚)
   └──────────┘
```

> 说明：当前代码中**没有**任何路径会把 `Item.status` 从 `RESERVED` 直接跳回 `ACTIVE`，**除了** `order.cancel`。互换链路的 `reject` 仅发生在 `PENDING`（此时 Item 还是 `ACTIVE`，未被改动）；而互换链路**没有"取消已接受的互换"接口**，意味着一旦进入 `ACCEPTED` 状态后中断，物品就会永远卡在 `RESERVED`。

---

## 3. 触发点与副作用清单

### 3.1 物品自身（[item.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts)）

| 方法 | 触发者 | 前置校验 | 写入的 Item.status | 副作用 |
|---|---|---|---|---|
| [`create`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L32-L57) | 物品所有者 | 分类存在 | `ACTIVE` | — |
| [`update`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L215-L248) | 物品所有者 | 仅校验 ownership / 分类存在 | 直接写入 `updateItemDto`（**不校验当前状态**） | ⚠️ 见冲突场景 4.2 |
| [`remove`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L256-L286) | 物品所有者 | 无进行中订单 (`PENDING`/`CONFIRMED`) | 物理删除 | ⚠️ **不检查互换请求**，见冲突场景 4.3 |
| [`offShelf`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L294-L311) | 物品所有者 | 仅校验 ownership | `OFF_SHELF` | ⚠️ **不校验当前状态**，可把 `RESERVED`/`SOLD` 强行变成 `OFF_SHELF`，见冲突场景 4.1 |
| [`onShelf`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L319-L340) | 物品所有者 | `status == OFF_SHELF` | `ACTIVE` | — |

### 3.2 订单链路（[order.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts)）

| 方法 | 触发者 | 对 Item 的前置校验 | 事务内对 Item.status 的写入 | 其它副作用 |
|---|---|---|---|---|
| [`create`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts#L41-L99) | 买家 | `status == ACTIVE` && `type == SELL` && 非自己 | `ACTIVE → RESERVED` | 创建 Order(PENDING) |
| [`confirm`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts#L148-L169) | 卖家 | 仅校验 Order=`PENDING` | 不动 | Order → CONFIRMED |
| [`complete`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts#L177-L215) | 买家 | 仅校验 Order=`CONFIRMED` | `任意 → SOLD`（未读校验当前 Item.status） | 卖家信用 +5 |
| [`cancel`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts#L223-L260) | 买家 / 卖家 | 仅校验 Order∈{`PENDING`,`CONFIRMED`} | `任意 → ACTIVE`（未读校验当前 Item.status） | Order → CANCELLED |

### 3.3 互换链路（[exchange.service.ts](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts)）

| 方法 | 触发者 | 对 Item 的前置校验 | 事务内对 Item.status 的写入 | 其它副作用 |
|---|---|---|---|---|
| [`create`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts#L28-L102) | 请求者 | `ownerItem.status==ACTIVE && type==EXCHANGE`，`requesterItem.status==ACTIVE && 属于自己`；同请求者+同 ownerItemId 在 `PENDING/ACCEPTED` 中无重复 | **不动**（仅创建 Exchange(PENDING)） | — |
| [`accept`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts#L156-L188) | ownerId | 仅校验 Exchange=`PENDING` | `requesterItem & ownerItem 的 status → RESERVED`（**未校验当前 Item.status**，使用 `updateMany`） | Exchange → ACCEPTED |
| [`reject`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts#L196-L217) | ownerId | 仅校验 Exchange=`PENDING` | 不动 | Exchange → REJECTED |
| [`complete`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts#L226-L265) | requester 或 owner 任一 | 仅校验 Exchange=`ACCEPTED` | `双方 Item → SOLD` | 双方信用 +5。⚠️ 注释写"双方都确认才完成"，但实际**单方一调用即完成** |

---

## 4. 两条链路冲突 / 并发 / 边界场景（至少 2 个，列 5 个并按严重度排）

> 共同根因：所有"占用 Item"的写操作都是 **应用层 read-then-write**，事务内只用 `prisma.$transaction(callback)`（默认隔离级别），但**没有 SELECT … FOR UPDATE / 没有乐观锁字段 / 没有把当前状态作为 update 条件**，因此并发下"占用语义"会失守。

### 4.1【严重】互换 ACCEPT 和订单 CREATE 同时发生 → 一物两卖
- 物品 A：`type=SELL`（这条限制让互换走不通）✅ 不会冲突
- 物品 A：`type=EXCHANGE`，订单链路 [order.create#L65-L67](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts#L65-L67) 直接拒绝 → ✅ 不会冲突
- **真正会冲突的场景**：物品 A 同时被两个互换请求 X、Y 锁定（不同请求者）：
  1. X 请求 A↔B（B 是 X 的物品），ownerItem A 校验 `status==ACTIVE` 通过 → 创建 Exchange X(PENDING)
  2. Y 请求 A↔C，同样校验通过 → 创建 Exchange Y(PENDING)
  3. owner 先 `accept(X)`：A、B → `RESERVED`；
  4. owner 紧接着 `accept(Y)`：[exchange.accept#L169-L184](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts#L169-L184) 只校验 `Exchange.status==PENDING`，**未读 Item 当前状态**，于是把 A、C 又强行写成 `RESERVED`，C 也被锁定。
  5. 最终任意一笔 `complete` 都会把 A 改成 `SOLD`，但**另一笔 ACCEPTED 互换没有任何机制收尾**，要么继续 `complete` 把 A 二次置为 `SOLD`（信用再 +5）、把 B 或 C 也置 SOLD；要么永远卡死。
- 影响：信用分被刷、物品多次置 SOLD、对账错乱。

### 4.2【严重】所有者并发改动绕过状态机
- [`item.update`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L215-L248) 只校验 ownership，不限制当前状态，且 `UpdateItemDto` 若包含 `status` 字段（取决于 DTO 是否过滤），所有者就可以把 `RESERVED`/`SOLD` 改回 `ACTIVE`，绕过状态机；
- [`item.offShelf`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L294-L311) 不校验当前状态，可以把 `RESERVED`（即正在交易的物品）直接覆盖成 `OFF_SHELF`：
  - 此时仍然存在一条 `Order(PENDING)`，[order.confirm](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts#L148-L169) 仍可继续推进，最终 `complete` 把 `OFF_SHELF` 又改回 `SOLD`，状态机彻底失序。
  - 互换链路同理：`accept` 后所有者把自己的 `ownerItem` `offShelf`，互换仍可被另一方 `complete`，导致已下架物品被改回 `SOLD`。

### 4.3【中-高】物品被删除时未检查互换
- [`item.remove`](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L256-L286) 只检查 `Order` 中是否存在 `PENDING/CONFIRMED`，**不检查 Exchange 表**。
- 后果：当一件 EXCHANGE 类型物品同时存在 `PENDING/ACCEPTED` 互换记录时，所有者依然能 `delete`。但 `Exchange.requesterItemId / ownerItemId` 是必填外键，Prisma/MySQL 在没有 `ON DELETE` 行为定义的前提下会抛错（数据库层失败），但这是**通过外键约束意外保护**的，应用层逻辑本身是裸奔的；如果外键被未来迁移改成 `SET NULL`/`CASCADE`，就会出现"互换记录指向幽灵物品"。

### 4.4【中】并发取消订单 + 互换 ACCEPT
1. 用户对物品 A（`type=SELL`）下单 → A 变 `RESERVED`，存在 Order O(PENDING)。
   - 此场景在当前代码里不会触发互换冲突，因为互换要求 `ownerItem.type==EXCHANGE`。
2. 但若 A 是 `EXCHANGE`：order.create 在第 65-67 行直接拒绝，A 不会进入订单 RESERVED；✅
3. 真正可能冲突的是：A 是 `EXCHANGE`，互换 X 进入 ACCEPTED → A=RESERVED；
   - 此时所有者再次发起一笔互换接受 Y（场景 4.1），或者 owner 把 A 通过 `update` 改 `type=SELL`（[item.update](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/item/item.service.ts#L240-L247) 没禁止），紧接着另一买家 `order.create`：
     - `order.create` 校验 `status==ACTIVE`，但 A 当前是 `RESERVED`，所以会被拒绝 ✅；
     - 然而如果 X 之前被 reject 之外的途径（无）或者 owner 用 `update` 把 status 改回 `ACTIVE`（4.2 场景），下单立刻成功，进入双链路占用同一件物品的状态。

### 4.5【中】互换 complete 单方触发 + 信用分双倍刷
- [exchange.complete](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts#L226-L265) 注释声明 "需要双方都确认才能完成"，但实现中只要 `requesterId === userId || ownerId === userId` 就直接进入完成事务，没有"双签"字段。
- 边界后果：
  - 任一方独自调用即可把双方两件物品打成 `SOLD`，对方无须同意。
  - 紧随 `accept` 多次互换，每次 `complete` 都会调用 `user.updateMany` 给双方 `creditScore += 5`，无防重；如果同一对用户在不同物品间反复 accept/complete，信用分可被无限刷高。
- 同样：[order.complete](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/order/order.service.ts#L177-L215) 在事务内不检查 `Item.status`，若上游被 4.2 篡改成 `OFF_SHELF`，仍会把它写成 `SOLD`。

---

## 5. 总结（"在售/已预订/已售出"切来切去的根本原因）

1. **状态语义同时由两个 Service 维护，但没有共享的状态机守卫**：
   - 订单链路把 `ACTIVE→RESERVED→SOLD/ACTIVE`。
   - 互换链路把 `ACTIVE→RESERVED→SOLD`（无回滚）。
   - 物品自身的 `update/offShelf` 还能任意横插。
2. **所有事务都是"先 findUnique 校验、再 update"，但 update 时没有用 `where: { id, status: <expected> }` 这种条件式 CAS**，因此并发下两条链路完全可能各自校验通过、各自把 Item 推到不同终态。
3. **`updateMany` 在 [exchange.accept#L181-L184](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts#L181-L184) 与 [exchange.complete#L252-L255](file:///e:/gsb/ai-apps-workspace/02.work%20session/session-gsb0617/gitlab%20source/app-26/app-26-mercury/src/modules/exchange/exchange.service.ts#L252-L255) 既无 `where.status` 限定，也没读校验**，是双链路冲突的最大放大器。
4. **`Item.type` 在订单链路里是硬隔离（`type==SELL` 才能下单）**，理论上让"出售订单"和"互换"在大多数情况下作用于不同物品；但只要所有者随后 `update` 修改 `type`，或者并发互换之间互相覆盖（场景 4.1），这道屏障就会失效。
5. **互换没有 cancel/timeout、订单 cancel 不检查互换、删除不检查互换**：状态最终一致性完全没有兜底，依赖外键约束做"硬保护"，应用层缺少业务保护。

---

## 6. 推荐的修复方向（不在本次执行范围内，仅作记录）

- 给 `Item` 加 `version Int` 字段，所有占用/释放走乐观锁：`update where: { id, status: 'ACTIVE', version }, data: { status: 'RESERVED', version: { increment: 1 } }`，根据 `count==0` 判断并发失败。
- `exchange.accept` 用 `update`（指定 id+期望 status）替代 `updateMany`，校验"两件物品当前都还是 ACTIVE"。
- `item.update / offShelf / remove` 在状态非 `ACTIVE/OFF_SHELF` 时拒绝；`remove` 同时检查 `Exchange` 表。
- `exchange.complete` 引入双签字段（`requesterConfirmed/ownerConfirmed`），两边都 true 才推进 `COMPLETED` 并发放信用分。
- 给互换补 `cancel`，把 `ACCEPTED` 状态可以回滚回 `ACTIVE`。
- 关键状态字段加 DB 检查约束 / 触发器，或将状态变更收敛到一个 `ItemStateMachine` 服务统一守卫。
