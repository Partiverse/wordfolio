# M-D 里程碑报告：公测准备

日期：2026-10-04 ｜ 状态：**待签收** ｜ 计划来源：移动端开发计划（2026-09-28 批准，HANDOFF §4）

> 报告骨架沿用 partisync-milestone-report 技能（§1–§8）；本仓为 Expo 项目，机器门禁以 pnpm 三件套 + 双端实测替代 cargo 体系。

## §1 范围与结果

计划范围（dev-plan）：词书选择（exam_tag 筛选）、edition 更新机制（下载新发布物替换）、连续打卡、Android beta → 公测轨道。

| 计划项 | 状态 | 交付与证据 |
|---|---|---|
| edition 更新机制 | ✅ | bootstrap 按 edition 删库重拷已实现（`src/db/upgrade.ts:12` 沙箱 edition ≠ 打包 edition 即 `recopy`，`src/db/release.ts:63-73` 执行删库重拷；词库无用户状态，学习数据在独立 learning.db 不受影响）。本里程碑补齐展示位：关于页 `src/app/about.tsx`（expo-constants app 版本 + `readReleaseMeta` 词库 edition/生成日期/规模 + 离线隐私说明，数值全读打包 meta 表不写死）、Root Stack 注册（`src/app/_layout.tsx:34`）、统计页「其他」卡入口（`(tabs)/stats.tsx:231-241`）。说明：应用内「下载新发布物替换」未做——实际换库机制 = 换包即换库（新包 BUNDLED_EDITION 变化触发自动重拷），内测期够用 |
| 连续打卡 | ✅ | 当前连续沿用 `computeStreak`（`src/study/stats-core.ts:4`）；本轮新增历史最长 `bestStreak`（`src/study/stats-core.ts:32`，去重排序后扫最长连续段，5 例 vitest）；统计页新增「最长连续」与「自由练习」累计次数两个数据位（`(tabs)/stats.tsx:93,99`）。自由练习口径 = `getPracticeTotal`（`src/db/study.ts:269`）只读 COUNT `review_log WHERE kind='practice'`——不占今日进度、不动排期，与逻辑树 §2 衔接点一致 |
| 词书选择（exam_tag） | ⏸ 阻塞 | 上游 exam_tag 表无数据（v0.1-m1 无标注数据，HANDOFF 已知坑 #2：cefr/band/collins_star 全 NULL，exam_tag 表全空）。逻辑树 §6 槽位保留（词库 tab 顶部入口 + 学习队列过滤），数据到位后接入 |
| TestFlight / Google Play | ⏸ 阻塞 | iOS：ADR-0006（Accepted）暂停 iOS，不注册 Apple Developer Program，TestFlight 无从谈起，恢复需按 ADR-0006 触发条件执行；Android：Google Play 需开发者账号，尚未注册 |
| 分发（链路确认） | ✅ | 本地 arm64 APK 链路稳定（expo prebuild + R8 混淆+资源收缩，2–5 分钟/包，不占 EAS 额度）；`dist/` 累计 beta.8–beta.16 九个包，最新 `wordfolio-0.1.0-beta.16-arm64.apk` 38MB（40,274,935 B，2026-10-04 17:28）。**注意：该包构建于 M-D 两个 commit（18:38/18:42）之前，M-D 改动尚未打进任何发布产物**，发内测前需重新构建 |

**降级说明**：两项阻塞均非实现能力问题——exam_tag 等上游标注数据、双商店等账号/策略决策；条件成熟后按逻辑树 §6 槽位接入即可，无需改信息架构。

## §2 验收证据

- **门禁**（2026-10-04 本报告撰写会话实跑）：`pnpm lint` 0 问题（expo lint）、`pnpm typecheck` 干净（tsc --noEmit）、**vitest 69/69 通过**（7 文件：bootstrap 3 / 检索 14 / FSRS 12 / 队列 8 / 统计 16 / 收藏 5 / 题型 11）
- **M-D 新增用例**（tests/stats-core.test.ts:31-49）：bestStreak 5 例——空序列 0、单日 1、连续段 3、跨段取最长（1-2 与 10-12 取 3）、跨月边界（08-30/08-31/09-01 连续 3）
- **代码闭环**：统计页四块原数据位保留 + 新增两块（自由练习/最长连续），icons 层新增 ChevronForwardIcon（`src/components/icons.tsx:19`）供「其他」卡入口使用；关于页三卡（版本/词库/隐私）+ 加载/错误态（about.tsx:57-67）
- **产物**：见 §1 分发行；beta.16 包不含 M-D 改动（构建时间早于 M-D commits）
- **规模**：src+tests 40 个源文件 / 4807 行；M-D 区间（`1cdd62f..e3bba00`）8 文件 +218/−9

## §3 测试证据

- 本地三道门禁为数字出处：`pnpm lint` / `pnpm typecheck` / `pnpm test`（vitest v5.0.2，Test Files 7 passed、Tests 69 passed，248ms）
- CI：M-D 两个 commit（`9affa36`、`e3bba00`）截至本报告时尚未 push（`origin/main..HEAD` 2 个），远端 CI 未及验证；push 后以 CI 为准
- 实机验证：M-D 实现切片记录为门禁验证（统计/关于页两切片摘要均以三道门禁为验收口径），本切片（文档收尾）未执行实机冒烟——关于页与统计新数据位的真机表现待签收时确认

## §4 质量事故与修复

| 事故 | 根因 | 修复 | 教训 |
|---|---|---|---|
| 无 | M-D 区间（`1cdd62f..e3bba00`）2 个 commit，无 fix/revert | — | — |

## §5 ADR 清单

- ADR-0005 客户端技术栈（Accepted，T0）
- ADR-0006 发布策略——Android beta 先行、iOS 暂停（Accepted，2026-09-29）
- M-D 期间无新增 ADR；统计位与关于页的设计决策记录于功能逻辑树 §2/§4/§6/§7 同步更新（两个 M-D commit 均含逻辑树改动）

## §6 AI 使用披露

- M-D 区间 commits 2 个（`9affa36` 统计页自由练习次数与最长连续打卡、`e3bba00` 关于页），全部由 AI 代理执行，用户以「确认发布范围 + 签收」把关
- 本报告由 AI 文档收尾切片撰写；§1/§2 全部数字与代码引用来自该会话实跑门禁与源码核对，未沿用前序切片口头数字

## §7 抽查审计记录

- 数据层改动集中在 `src/db/study.ts`：`getPracticeTotal` 为只读 COUNT，不写库、不碰 FSRS 排期字段——抽查确认练习口径与逻辑树 §2「自由练习只写 review_log(kind='practice')」一致
- 纯函数 `bestStreak` 落 `src/study/stats-core.ts`（无 RN/SQLite 依赖），符合「纯逻辑拆纯函数 + vitest」仓库规约；入参无需有序、可含重复（Set 去重），与 `computeStreak`（「今天还没学」从昨天回数）语义互补
- 关于页词库数值全部读自打包内 meta 表（`readReleaseMeta`，`src/db/release.ts:78`），无写死数值（about.tsx:12 注释明示）；离线隐私文案与 ADR-0005「本地优先零后端」一致
- 无新增外部依赖（expo-constants 为 Expo 内置模块）；未触碰 android/、ios/ CNG 生成物

## §8 下一阶段建议（公测/签收后）

开放债务：
- **发内测包**：重新构建以包含 M-D 改动（beta.16 构建于 M-D commits 之前），或 bump beta.17
- **上游阻塞**：exam_tag/CEFR 标注 → 解锁词书选择与难度筛选；例句数据（M2-T08）→ 解锁例句挖空（M-C 遗留）
- **双商店**：注册 Google Play 开发者账号后走公测轨道；iOS 恢复按 ADR-0006 触发条件执行，届时补验通知链路
- FSRS 参数：request_retention 0.9 冻结至内测数据回收（逻辑树 §5.4），回收后按遗忘曲线实测调整
- EAS Update OTA：`channel: beta` 已预留未启用——作为热修/词库小更新的候补通道评估

## 放行签字（G3 适配）

- [ ] 用户验收（Milestone Owner）：＿＿＿＿
- [ ] 安全复核：＿＿＿＿（最近一次 Mimosa deep 扫描归档 `docs/security/2026-09-29-mimosa-deep-scan.md`，主仓 0 发现；M-D 无新增依赖，未重扫）
