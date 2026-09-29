# M-A 里程碑报告：词库浏览 MVP

日期：2026-09-29 ｜ 状态：**待签收** ｜ 计划来源：移动端开发计划（2026-09-28 批准）

> 报告骨架沿用 partisync-milestone-report 技能（§1–§8）；cargo 系门禁不适用于本 Expo 仓，以 pnpm lint/typecheck/vitest + 双端实测替代。

## §1 范围与结果

| 计划项 | 状态 | 交付 |
|---|---|---|
| browse 浏览网格 | ✅ | 双列网格、freq_rank 排序、50/页增量加载、词性筛选 |
| 义项卡 | ✅ | `SenseCard`：pos 徽标 + 中英定义 + 例句区（条件渲染） |
| FTS 搜索 | ✅ | 拉丁 FTS5 前缀 + bm25；**CJK LIKE 回退**（unicode61 不分词中文的 T0 缺口关闭） |
| 筛选 | ✅/降级 | 词性筛选上线；**CEFR 筛选降级**——v0.1-m1 无标注（entry.cefr 全 NULL），repository 参数保留待 v0.2 |
| 收藏 | ✅ | learning.db（ADR-0005 D3 用户库分离首次落地）+ zustand 乐观更新 + 收藏视图 |
| TTS 点读 | ✅ | 词头/释义/例句中英点读（expo-speech） |
| 暗色主题 | ✅ | tokens light/dark 双端实测（iOS 浏览屏 + Android 浏览/详情屏） |
| 内部包 | ✅ | EAS 云构建（免费档）Android preview APK 产出并冒烟通过；iOS/TestFlight 另需 Apple 开发者账号（见 §2 备注） |

降级说明：① nativewind 未接入（T0 决议维持 RN 主题对象，接入挪至 M-B 前评估）；② TestFlight 未开：EAS 免费档可出 iOS 包，但提交 TestFlight 需 Apple Developer Program（付费，$99/年）与 EAS 凭据；Android 内部包已通。

## EAS 交付现状（2026-09-29 更新）

- 账号：`partiverses-team`（Free 档）——**免费档额度足够本项目节奏**：每月 15 Android + 15 iOS 构建、低优先级队列、CI/CD 60 分钟、提交 App Store、EAS Update 1K MAU；免费档不会产生超额扣费（用尽即停）
- 首次 Android preview 云构建：17 分钟（低优先级队列）→ `dist/wordfolio-preview-eas.apk`（105MB）→ 模拟器安装冒烟通过
- 实测队列延迟：低优先级下 17 分钟可接受；若 M-D 内测期需频繁出包，Starter（$19/月，含 $45 build credit）可换高优先级与超额能力

## §2 验收证据（替代 KPI 表）

- 发布物 v0.1-m1：499 词 / 2495 义项，FTS5=YES（双端）
- 检索：`run` 8 行（bm25）；中文单字 `走` 12 行（LIKE 回退，原 FTS 0 行）
- 测试：vitest **17/17 通过**（bootstrap 3 + 检索纯函数 9 + 收藏纯函数 5）；`pnpm lint` 0 问题；`tsc --noEmit` 干净
- 实测：Android 模拟器（wordfolio_test/API 35）+ iOS 模拟器（iPhone 18 Pro/iOS 27）；截图存 `screenshots/`（不入库）

## §3 测试证据

- CI：github.com/Partiverse/wordfolio Actions 绿（lint+typecheck+vitest）
- 关键实测修复：浏览↔搜索 FlatList numColumns 切换 Invariant（加 `key` 强制重建）——真实设备抓出、回归由双屏切换路径覆盖

## §4 安全

- Mimosa deep 扫描（2026-09-29，见 `docs/security/2026-09-29-mimosa-deep-scan.md`）：
  - 本仓 **0 发现**、36 依赖 0 命中（封印 `f34af9ab…`）
  - 上游 wordfolio-lexicon：2 LOW（固定种子可复现抽检，研判误报接受）；1 依赖通告未回传包名，**待 pip-audit 定位**
- 敏感信息：`.env.example` 仅占位符；密钥不入库（人工核查 + 扫描无命中）

## §5 ADR 清单

- ADR-0005 客户端技术栈（Accepted，T0 期；含 ts-fsrs 修订并已回写上游 `7d3da09`）
- M-A 期间无新增 ADR；CJK LIKE 回退属实现决策，记录于 `src/db/search.ts` 头注与 T0 spike 结论

## §6 AI 使用披露

- 本仓 commits 全部由 AI 代理执行（ZCode 会话），用户以「评审决策 + 逐项确认 push」方式把关；无 `AI-Assist`/`Reviewed-By` trailer 机制，替代证据为会话记忆链 + 里程碑报告
- M-A 范围 commits：`08cea21..6c1ed77`（T0 收尾文档 → 第一批 58abf92 → 第二批 328e598 → 审计归档 6c1ed77）

## §7 抽查审计记录

- 抽查 3 项关键改动可回溯性：CJK 回退（search.ts 头注 + T0 结论 §中文检索缺口）✅；learning.db 分离（ADR-0005 D3）✅；UIScene 修复（commit e628ba3 + expo/fyi 依据）✅
- commit 链核对：`git log` 与记忆/报告一致，无未记录改动

## §8 下一阶段建议（M-B 学习闭环）

开放债务：EXPO_TOKEN + `eas init`（解锁 EAS/TestFlight）；pip-audit 定位上游 1 条依赖通告；CEFR 标注待上游 v0.2 数据；nativewind 接入评估。

M-B WP 建议：ts-fsrs 复习队列（learning.db 扩 review 表）→ 禅意闪卡移植（设计系统 tokens 已就绪）→ 四键评分 → 每日目标与统计 → expo-notifications 提醒。

## 放行签字（G3 适配）

- [ ] 用户验收（Milestone Owner）：＿＿＿＿
- [ ] 安全复核：扫描已归档，低危处置已记录 ✅
