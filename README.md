# okki-tag-hang-on

OKKI CRM 邮件打标签（标签回写）标准流程。输入：mail_id 列表 + 每封 required_labels（由调用方给出，如研究输出的 planned_labels，本技能不重算标签）。

## 功能

```
读 chips（已应用集合）→ 点固定标签按钮开菜单 → 批量应用已有标签（单次 JS 一次打多个）→
按名称创建缺失标签（创建即自动应用）→ 重读验证全部标签到位
```

支持：
- 收件箱有效邮件 grade/country/product 标签
- 重复邮件标签（`重复邮件`）
- C1 待核验标签（`C1类待核验`，不删除）
- 已删除邮件的 D/E/N 类别标签（`D类疑似垃圾`/`E类营销邮件`/`N类通知邮件`）

## 核心机制（实测沉淀）

| 经验 | 内容 |
|------|------|
| chips 判定 | 标签树节点**不暴露选中态**，应用结果以详情页 `.mail-plus-tag-list` 标签 chip 为准（排除零宽字符精确比对） |
| 固定控件复用 | 标签按钮 `.mail-toolbar-wrapper.open-detail .mail-toolbar-btn-item-tag button` 首次解析后**全程复用，禁止逐封重复侦察** |
| 事件序列触发 | 展开标签菜单必须用真实事件序列 `pointerdown → mousedown → pointerup → mouseup → click`，`.click()` 无效 |
| 菜单树重建 | 新建标签后菜单树重建，刚渲染节点首次点击可能未注册 → 重开菜单补点一次（不会重复应用），绝不重复创建 |
| 批量应用 | 先读 chips 得"已应用集合"，单次 JS 批量点击"目标标签 ∩ 未应用"节点；已应用绝不点（点击会变成移除） |

## 三重验证

- 变更前：详情 mail_id = 台账 ID
- 应用后：重读 chips，required_labels 全部在位（缺失只重试一次）
- 纪律：新建标签绝不二次点击；Tag/Delete/Next 点击后条件等待（最小 ≥0.3 秒）

## 安装

将 `SKILL.md` 复制到 agent 技能目录，并在 `skills.jsonc` 中注册：

```json
{
  "skills": [
    {
      "id": "tag-hang-on",
      "name": "tag-hang-on",
      "version": "",
      "enabled": true,
      "kind": "directory",
      "entryName": "tag-hang-on",
      "installPath": "<绝对路径>/tag-hang-on"
    }
  ]
}
```

## 前置条件

- 浏览器已登录 OKKI CRM（crm.xiaoman.cn），登录态有效
- 调用方提供：`mail_id` + `required_labels`（每封一个标签计划）
- 新建专用 OKKI 标签执行（或聚焦调用方已打开的 OKKI 标签）

## 已验证选择器

| 元素 | 选择器 |
|------|--------|
| Mail ID | `a.mail-detail-fixed-header--opts__left--item[href*='mail_id=']` |
| 主题 | `h1.mail-detail-fixed-header--title` |
| 标签按钮（固定） | `.mail-toolbar-wrapper.open-detail .mail-toolbar-btn-item-tag button` |
| 标签菜单交互子元素 | `.mm-tree-node-content`（外层 item accessibility-disabled 时点击它） |
| 已应用标签 chips | `.mail-plus-tag-list`（应用结果唯一判定依据） |

## 实测记录

| 日期 | 场景 | 结果 |
|------|------|------|
| 2026-08-19 | 前 3 封，混合已存在/新建（水单/样品PI 复用 + 新建 标签测试/AA/B/C/美国） | ✅ 3/3×3 |
| 2026-08-19 | 第 4-6 封，批量应用 8 个已存在 + 新建 澳大利亚（提速验证：调用数减半、无中断） | ✅ 3/3×3 |

## 配合主流程

- 进入/切换邮件：用 `okki-email-change`（按 list_index 点击行内 `.subject`）
- 标签计划来源：调用方研究输出 `planned_labels`（如 okki-inbox-triage-and-research 的 Stage 2 产出）
- 来源：完整提取自 okki-inbox-triage-and-research（Stage 3/4 + browser-workflow 选择器），适配 Accio 浏览器子代理环境
