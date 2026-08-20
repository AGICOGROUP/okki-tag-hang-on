/* ============================================================
 * tag-hang-on / scripts/refresh_labels_cache.js
 * 读取 OKKI 全部标签目录 —— 标准脚本（即插即用，无需侦察页面结构）
 *
 * 用法：
 *   1. 在已登录 OKKI 页面（crm.xiaoman.cn）浏览器 console 执行本脚本
 *   2. 返回 { ok, count, names[], sysCount, customCount, ms }
 *   3. 调用方将 names 覆盖写入 <技能目录>/labels-cache.json（含 updated_at）
 *
 * 调用频次约束（任务级一次）：
 *   每个任务在第 1 封邮件打标签前执行一次；整个任务后续所有邮件复用该次
 *   结果，绝不重复运行本脚本（单次调用不触发风控）。
 *
 * ============================================================
 * 已验证页面结构（2026-08-20 实测，无需重新侦察）：
 *   API 路径   : GET /api/generalTagRead/list（同域）
 *   Method     : GET，无 query 参数、无自定义头
 *   认证方式   : Cookie 会话（credentials:'include'）
 *   响应结构   : { code, msg:"success", now, data:{ count, list:[...] } }
 *   list 字段  : tag_id(number) | tag_name(string) | tag_color(hex)
 *                | system_flag("1"|"0") | user_id(number) | create_time
 *                | order_rank | user_info(array)
 *   系统/自定义: system_flag==="1" && user_id===0 → 系统标签
 *                其余 → 自定义标签
 *   覆盖范围   : 返回全部标签（含被前端打标菜单过滤的自动分发类：
 *                已分发邮件/接收分发邮件/AiReach）
 *   实测耗时   : 232ms / 238ms（远低于 1 秒）
 * ============================================================ */
(async () => {
  const t0 = performance.now();
  const r = await fetch('/api/generalTagRead/list', {
    method: 'GET',
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });
  const j = await r.json();
  const list = (j && j.data && j.data.list) || [];
  return {
    ok: r.ok,
    count: list.length,
    names: list.map(t => t.tag_name),
    sysCount: list.filter(t => t.system_flag === '1').length,
    customCount: list.filter(t => t.system_flag !== '1').length,
    ms: Math.round(performance.now() - t0)
  };
})()
