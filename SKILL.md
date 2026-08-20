---
name: tag-hang-on
description: >-
  OKKI CRM 邮件打标签（标签回写）标准流程。输入：mail_id 列表 + 每封 required_labels（由调用方给出，
  如研究输出的 planned_labels；本技能不重算标签）。核心：拆分为目录已有/缺失两组 → 批量应用已有标签（单次 JS 一次打多个） +
  按名称创建缺失标签（创建即自动应用，验证后绝不再点击）→ 重读验证全部标签到位。支持收件箱有效邮件
  grade/country/product 标签、重复邮件标签（重复邮件）、C1 待核验标签（C1类待核验）、以及已删除邮件的
  D/E/N 类别标签（D类疑似垃圾/E类营销邮件/N类通知邮件）。
  触发词：打标签、挂标签、应用标签、标签回写、给邮件加标签、apply labels、tag mail、标签创建。
  前置依赖：调用方提供目标 mail_id 与 required_labels；浏览器已登录 OKKI CRM。
  来源：从 okki-inbox-triage-and-research 完整提取 Stage 3/4 标签流程。
---

# OKKI 邮件打标签（tag-hang-on）

## 职责边界

- 本技能只负责：**标签应用/创建 + 最终验证**（对已打开或可从列表导航到的邮件）
- **输入**：`mail_id` 列表 + 每封的 `required_labels`（调用方给出，如研究输出的 `planned_labels`；本技能**不重算**标签）
- **不负责**：邮件切换/遍历（用 `okki-email-change`）、附件下载（`okki-attachment-download`）、客户研究/分级（由调用方完成）
- **特殊类型处置**（含删除动作，属标签流程的完整部分）：duplicate → 仅 `重复邮件`；C1 → 仅 `C1类待核验`（不删除）；D/E/N → 删除后进入已删除邮件打类别标签

## 前置条件

- 浏览器已登录 OKKI CRM（crm.xiaoman.cn），登录态有效
- 调用方提供：`mail_id` + `required_labels`（每封一个标签计划）
- 新建专用 OKKI 标签执行（或聚焦调用方已打开的 OKKI 标签），不关闭、不操作无关标签

## 已验证选择器（2026-08-19 从 okki-inbox-triage-and-research 提取）

| 元素 | 选择器 |
|------|--------|
| Mail ID | `a.mail-detail-fixed-header--opts__left--item[href*='mail_id=']` |
| 主题 | `h1.mail-detail-fixed-header--title` |
| 下一封 | `.mail-toolbar-wrapper.open-detail .mail-paging.tool-bar-paging .right-btn button` |
| 标签按钮 | `.mail-toolbar-wrapper.open-detail .mail-toolbar-btn-item-tag button` | **固定控件，全程复用** |
| 删除按钮 | `.mail-toolbar-wrapper.open-detail .mail-toolbar-btn-item-delete button` |
| 列表行 | `li.plain-list-item` |
| 标签菜单交互子元素 | `.mm-tree-node-content`（外层 item accessibility-disabled 时点击它） |
| 已应用标签 chips | `.mail-plus-tag-list` | 应用结果唯一判定依据 |

**实测补充（2026-08-19 打标签实测）**：
- 标签树节点**不暴露选中态**，菜单内无法判断标签是否已应用——**以详情页 `.mail-plus-tag-list` 的标签 chip 为准**（排除零宽字符后精确比对）
- "标签"按钮为**固定控件**：首次解析一次后**全程复用，禁止逐封重复侦察**

**实测补充 2（2026-08-19 批量应用实测，3 封 9 标签全部 3/3 通过）**：
- **标签按钮展开菜单必须用真实事件序列**：`pointerdown → mousedown → pointerup → mouseup → click`，单独 `.click()` 无法展开菜单
- **新建标签后菜单树会重建**：刚创建/刚渲染的标签节点需在菜单重开后才稳定，首次点击可能未注册（chips 无变化且菜单自动关闭）；处理：重开菜单后用同一事件序列**补点一次**即成功——**不会造成重复应用**（chips 中标签只出现一次，无 toggle-off），也**绝不重复创建**
- 批量应用已验证高效：读 chips → 开菜单 → 单次 JS 批量点击"目标∩未应用" → 关菜单 → 重读验证，每封约 8 步

首次使用：Tag/Delete/Next 控件必须恰好各 1 个，解析一次后**全程复用**（含标签按钮、菜单结构、创建入口）。**禁止逐封重复侦察已记录控件**——每封邮件直接复用首次解析结果；仅在 count 变化、预期 ID 未加载、文件夹变化或验证失败时才重读 DOM。

## 标签目录缓存（本地）

- **文件**：`<技能目录>/tag-hang-on/labels-cache.json`（与 SKILL.md 同目录；首次使用由本技能生成）
- **格式**（JSON，简单可扩展）：

```json
{
  "updated_at": "2026-08-20T10:00:00+08:00",
  "labels": ["智能销售", "开发信", "平台询盘", "报价", "PO", "PI", "PL", "CI", "水单", "样品PI", "个人询盘", "已分发邮件", "接收分发邮件", "AiReach"]
}
```

- **读取方式（标准脚本，1-3 秒）**：在已登录 OKKI 页面 console 执行 `scripts/refresh_labels_cache.js`——单次 fetch `GET /api/generalTagRead/list`（`credentials:'include'`，无需自定义头，实测 ~230ms），返回全部标签名数组（系统 + 自定义，比 DOM 菜单更全——含被菜单过滤的 3 个分发类标签）
- **刷新时机（一次任务只提取一次）**：每个任务在**第 1 封邮件打标签之前**运行脚本提取**一次**；整个任务后续无论处理多少封邮件，**全部复用该次提取结果，绝不重复运行脚本**（任务级缓存，单次调用不触发风控）
- **脚本即插即用**：`scripts/refresh_labels_cache.js` 已固化当前已验证的页面结构（API 路径 `/api/generalTagRead/list`、响应字段 `data.list[].tag_name`、`system_flag` 区分系统/自定义），子代理到达已登录 OKKI 页面后**直接运行即可拿到最新标签列表，无需重新侦察页面结构**
- **覆盖写策略**：每次用新读取的标签数量与字段**整体替换**旧记录（含 `updated_at`），不做增量合并——新出现的标签自然进入缓存，已删除的标签自然消失
- **用途**：打标签时**读本地缓存**判断 `existing_labels`（缓存中有）与 `missing_labels`（缓存中没有），**不再逐个开菜单现查**（减少浏览器往返）
- **同步**：脚本 B 每成功新建一个标签，**立即追加写入缓存**（保持与 OKKI 实际目录一致）
- **防过期**：以任务开始时的刷新结果为准；执行中发现缓存中的标签在菜单中不存在（缓存过期）→ 重新运行脚本刷新缓存后继续

## 执行步骤

### 阶段 A — 收件箱邮件打标签

0. **刷新标签目录缓存（标准脚本，1-3 秒，任务级一次）**：在已登录 OKKI 页面 console 执行 `scripts/refresh_labels_cache.js`（单次 fetch `/api/generalTagRead/list`，脚本已固化页面结构、直接运行）→ 取回 `names` 数组 → 覆盖写 `labels-cache.json`（含 `updated_at`，首次使用即生成该文件）。**仅本任务第 1 封邮件打标签前执行这一次**——后续所有邮件复用该缓存，绝不再运行脚本
1. 进入 `邮件 → 收件箱`，从列表打开目标邮件（从最新目标开始，用"下一封"推进；**不用复制的详情 URL 导航**）
2. **变更前验证**：详情 mail_id = 台账 ID（不一致则停止该封，报告）
3. 拆分标签（**读本地缓存 `labels-cache.json`**）：`existing_labels`（缓存中有）与 `missing_labels`（缓存中没有）
4. **脚本 A — apply_existing_labels（批量化，一次打多个已有标签）**：
   a. 先读详情页 `.mail-plus-tag-list` 的 chips → 得到"已应用标签集合"
   b. 打开标签菜单：点击固定标签按钮，**必须用真实事件序列触发**（`pointerdown → mousedown → pointerup → mouseup → click`，`.click()` 无效）
   c. **单次 JS 批量点击**所有"目标标签 ∩ 未应用"的菜单节点：遍历菜单节点按名称匹配，只点击不在 chips 中的目标标签；已应用的**绝不点**（点击会变成移除）
   d. 关闭菜单，统一等待后进入最终验证
5. **脚本 B — create_and_apply_labels**：按名称创建每个缺失标签并立即应用（**创建即自动应用**；应用后验证 ID/可见性，**绝不再点击它**——二次点击会把它从当前邮件移除）。**注意菜单树重建**：刚创建的节点需重开菜单后才稳定，首次点击未注册（chips 无变化）时重开菜单用同一事件序列补点一次，**绝不重复创建、绝不二次应用已成功的标签**。**每个新标签创建成功后，立即追加写入 `labels-cache.json`**（保持缓存与 OKKI 同步）
6. **最终验证**：重读当前邮件可见的已应用标签，确认全部 `required_labels` 在位；有缺失只重试缺失步骤一次，再验证
7. 特殊类型处置：
   - valid duplicate：只应用 `重复邮件`，不删除，不加 grade/country/product 标签
   - C1：只应用 `C1类待核验`，不删除、不加其他标签、不报告
   - D/E/N：记录 mail_id，删除当前邮件（删除自动推进到下一封）
8. 每次点击后**优先条件等待**（等待目标状态出现即继续：如 chip 出现、菜单打开/关闭完成），最小等待 ≥0.3 秒；随后重读 ID/状态确认（均为异步操作）

### 阶段 B — 已删除邮件类别标签（Stage 3 删除全部完成后）

1. 进入 `已删除邮件`
2. 从列表重新打开每个已删除目标，**验证原 mail_id**
3. 应用且**仅应用一个**：`D类疑似垃圾` / `E类营销邮件` / `N类通知邮件`
4. 纪律：**删除前不打标签**；应用类别标签后**不再删除**

## 硬性纪律

- 选择器 count()===1 后才操作；不为 1 时重读 DOM，**不猜测、不用坐标**
- 标签菜单中外层 item accessibility-disabled 时，点击交互子元素 `.mm-tree-node-content`
- **绝不第二次点击新建标签**（会把标签从当前邮件移除）
- Tag/Delete/Next 均视为异步：点击后**优先条件等待**，最小等待 ≥0.3 秒再重读
- **固定控件复用**：标签按钮、标签菜单结构、chips 结构（`.mail-plus-tag-list`）首次解析后**全程缓存复用**，禁止逐封重新侦察（仅在 count 变化、文件夹变化或验证失败时重读）
- 不构造、不粘贴邮件详情 URL；始终从列表导航
- 不用 OKKI API / connector / cookie / local storage / 桌面视觉控制（正常运行时）

## 输出格式（最终报告）

```
1. 处理汇总：总邮件数 | 已打标签数 | 各类别计数（valid/duplicate/C1/D/E/N）
2. 每封明细：mail_id | 主题 | required_labels → 实际应用 | 验证结果（在位/缺失）
3. 缺失重试记录（如有）：邮件 | 缺失标签 | 重试结果
4. 已删除邮件：mail_id | 原分类 | 类别标签应用结果
5. 标签目录缓存：`labels-cache.json` 路径 | 刷新时间 | 缓存标签总数 | 本次新建并写入的标签
6. 异常说明（如有）
```

## 失败处理

| 情况 | 处理 |
|------|------|
| 详情 mail_id ≠ 台账 ID | 停止该封，报告，不执行任何变更 |
| 标签应用后验证缺失 | 仅重试缺失标签一次，再验证 |
| 新建标签被误二次点击 | 立即重读应用状态，必要时重新应用 |
| 标签菜单无法展开（`.click()` 无效） | 改用真实事件序列 `pointerdown/mousedown/pointerup/mouseup/click` |
| 刚创建/刚渲染的标签节点首次点击未注册 | 重开菜单后用同一事件序列补点一次（不会造成重复应用）；绝不重复创建 |
| 选择器 count ≠ 1 | 重读 DOM；仍失配则报告阻塞 |
| 标签目录无法打开 | 重试一次；失败则报告，不猜测 |

## 校验清单（每次打标签后）

- [ ] 每封变更前验证 mail_id = 台账 ID
- [ ] 每封 required_labels 全部在位（重读可见标签确认）
- [ ] duplicate 仅挂 `重复邮件`
- [ ] C1 仅挂 `C1类待核验`，未删除、未加其他标签
- [ ] D/E/N 已删除且删除前未打标签
- [ ] 已删除邮件各挂且仅挂一个 D/E/N 类别标签
- [ ] 任务开始已刷新 `labels-cache.json`（首次使用=生成该文件）
- [ ] 新建标签已追加写入缓存，缓存与 OKKI 实际目录一致
- [ ] 每个动作后均条件等待（最小 ≥0.3 秒）且重读确认

_创建日期：2026-08-19。完整提取自 okki-inbox-triage-and-research（Stage 3/4 + browser-workflow 选择器），适配 Accio 浏览器子代理环境。_
