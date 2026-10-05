# M-H 里程碑报告：每日目标双轨拆分 / 新卡补卡顺序（Anki 调度语义对齐）

日期：2026-10-05 ｜ 状态：**待签收** ｜ 计划来源：移动端开发计划（2026-09-28 批准）M-H 调度体验切片（H1–H2）

> 报告骨架沿用 M-G 报告（§1–§8，源出 partisync-milestone-report 技能）；本仓为 Expo 项目，机器门禁以 pnpm 三件套 + 实机冒烟替代 cargo 体系。与 M-G 不同，本切片主题是学习调度语义与 Anki 对齐，故 §1 以「Anki 调度语义对照表」开篇，随后为范围与结果表。

## §1 Anki 调度语义对照表

本仓调度内核自 M-D 起采用 FSRS（ts-fsrs v5，request_retention 0.9），与 Anki 现代版（2.1.50+ 默认 FSRS）同款调度算法；经典 SM-2 未采用是刻意决策——FSRS 记忆模型更精细，且参数已按 M-D 决定冻结至内测数据回收（功能逻辑树 §5.4）。调度内核之外，Anki 的**队列构建层**有一套成熟语义（每日新卡上限、复习优先、抓取顺序、筛选牌组），本切片（H1/H2）将其中三项在本仓对齐/固化，对照如下：

| Anki 概念 | Anki 语义 | 本仓对应 | 对齐状态 |
|---|---|---|---|
| new cards/day | 每日新卡引入上限，独立于复习上限 | H1：`daily_goal` 拆 `new_target`/`new_completed` 双列（复习目标沿用原 `target_count`），`buildTodayQueue` 双上限签名 | **已对齐**（`09af8c8`）——此前为单目标混合上限 |
| review before new | 队列先复习后新学 | `sortForQueue` 复习卡在前（`src/study/fsrs-core.ts:86`，既有行为）；H1 双上限下两段各自排序、复习段在前成为显式语义并配单测 | **已固化**（`09af8c8`）——由实现细节升级为语义约定 |
| gather order | 新卡从牌库抓取的顺序（deck 顺序/随机等） | H2：`newCardOrder` 三档（freq 词频序 / random 随机 / favoriteFirst 收藏优先），纯函数 `orderNewCards` 可注入 rng | **已对齐（三档）**（`6bb6933`）——作用边界为候选选取（gather），入队后仍按 due/stable_id 稳定排序 |
| filtered deck / custom study | 临时筛选牌组（收藏重学、考前突击等自定义队列） | 收藏优先补卡部分覆盖「优先学收藏」意图；完整筛选队列（自选条件组建临时队列）未做 | **部分对齐**——完整筛选队列/自定义牌组列为下轮候选（见 §8） |

### 范围与结果表

M-H 区间（`47cb134..95efcbd`）3 个 commit（H1 双目标拆分、H2 新卡顺序、release beta.22）。src+tests 10 文件 +525/−69，release commit 仅 app.json 1 行（`git diff --stat 47cb134..95efcbd` 实测，未触碰 android/、ios/ CNG 生成物，package.json 零改动）。

| 切片 | 范围 | 实现要点 | 证据 commit |
|---|---|---|---|
| H1 每日目标双轨拆分（F5 清偿） | daily_goal 拆复习/新学双目标，队列双上限且复习在前，评分按卡型分列入账 | ① Schema 迁移（`src/db/study.ts` bootstrap，参照 review_log.kind 的 try-ALTER 写法）：建表语句补 `new_target INTEGER NOT NULL DEFAULT 5` / `new_completed INTEGER NOT NULL DEFAULT 0`（`study.ts:71-72`）；旧库 try-ALTER 成功才回填 `UPDATE daily_goal SET new_target = min(target_count, 5)`（`study.ts:86-92`，失败=列已存在跳过，新装库靠列 DEFAULT 语义一致）。取舍：老行复习目标沿用原 target_count（队列本就复习优先），新学目标给保守份额 min(5, target_count)——升级后日总量最多 +5、不突变；new_completed 归零（历史完成数无法回溯拆分，历史图表只受次日起新数据影响）。② `buildTodayQueue`（`src/study/fsrs-core.ts:102`）改双上限签名 `(cards, reviewLimit, newLimit, now)`：到期非新卡截 reviewLimit、新卡截 newLimit（`fsrs-core.ts:110-114`），两段各自 sortForQueue 后复习段在前、新学段在后；唯一调用方 study.tsx 聚焦重建同步更新。补新卡条件由「dueCount < target」改为「存量新卡数 < newTarget」（复习缺口无法人为补，只能等排期）；SEED_BATCH 保留。③ 评分入账拆列（study.tsx `rate()`）：评分前 `current.state === State.New` 记 new_completed+1，否则 completed+1；review_log 照旧追加不受影响。`setDailyCompleted`/`setDailyTarget` 签名扩为双目标五参数，全部 SQL 参数绑定。`getStudyStats` activeDays 口径同步改为 `completed_count > 0 OR new_completed > 0`（只学新卡的天也算打卡）。④ 统计页「每日目标」卡拆「复习目标」[10,20,30,50] /「新学目标」[5,10,20,30] 两行（沿用 targetRow/targetBtn 风格，新增 targetLabel 样式）；hint 显示「队列先复习后新学；今天已新学 x/N」。学习页进度文案取分列式「今日 复习 a/R · 新学 b/N · 剩 k」（两目标口径不同，合计式会失真），完成页文案同步拆分、完成判定改 completed+newCompleted>0；进度条按两目标合计口径。⑤ 备份往返：DailyGoalRow 加 new_target/new_completed，exportLearningData SELECT 与 importLearningData INSERT 均带新列；解析层（merge-core validateDailyGoalRow）对旧版备份缺省宽容回填 min(target_count,5)/0 而非报错，新旧备份均可导入，配 vitest 用例（含 target_count<5 不越界） | `09af8c8` |
| H2 新卡补卡顺序设置 | settings 新增三档偏好（词频/随机/收藏优先），学习页补卡经 orderNewCards 重排 | settings 新增 `key='newCardOrder'`（freq/random/favoriteFirst 三档）；新纯函数模块 `src/study/order-core.ts` 提供 `parseNewCardOrder`（`order-core.ts:21`）与可注入 rng 的 `orderNewCards`（`order-core.ts:61`）。学习页聚焦建卡改为经 `getSeedCandidates`（`src/db/repository.ts:275`，返回 freq_rank/entry_id 元数据）→ JS 侧合流 learning.db favorite 集合 → orderNewCards 重排后截取建卡（`src/app/(tabs)/study.tsx:136-142`）。统计页新增「新卡顺序」三段 segChip 选择，偏好恢复/乐观写沿用 ratingMode 同模式（竞态防护 refs 由 rating 专用改名 prefWriteSeqRef/prefWritePendingRef，两个偏好共用同一 guard，`stats.tsx:98-100`）。**与需求说明的偏离**：ask 称 favorite 表是 stable_id 级，但现实 schema（`src/db/study.ts:29-32`，getFavoriteEntryIds 返回 entry_id）是 entry_id 级——按现实调整为「收藏词条（entry）的义项排前」，favoriteFirst 语义为义项所属 entryId ∈ 收藏集合。random 语义：仅在每次聚焦重建队列时随机一次（从 goal.newTarget×4 候选池洗牌后取 need 个），不追求全天稳定；tests/order-core.test.ts 用恒 0 / 恒 0.5 固定随机源断言确定性输出（如恒 0 时 [a,b,c,d]→[b,c,d,a]）。顺序作用边界：重排作用于候选选取（Anki gather order）；入队后 buildTodayQueue→sortForQueue 仍按 due/stable_id 稳定排序（`fsrs-core.ts:86-95`），新卡段内展示序未动。`getSeedSenseIds` 保留为向后兼容包装（委托 getSeedCandidates，`repository.ts:291-292`），全仓唯一调用方 study.tsx 已切换；SQL 全部参数绑定（仅 LIMIT ?），无字符串拼接。schema 无需迁移（settings 为 key/value 表，新 key 零迁移；备份导出/导入按 key 合并自动携带 newCardOrder） | `6bb6933` |
| V1 beta.22 构建与冒烟 | 构建 + 覆盖安装 + 6 项冒烟（升级路径 + H1/H2 新功能 + 回归） | dist APK `wordfolio-0.1.0-beta.22-arm64.apk`（40,508,151 B，2026-10-05 23:13）；aapt2 dump badging 复核 `versionName='0.1.0-beta.22'`、`com.partiverse.wordfolio`（本报告切片实跑）。模拟器 emulator-5554（AVD wordfolio_test）beta.21 覆盖安装升级 + 6 项冒烟全过（详见 §3），截图 22 张 `dist/smoke-beta22/` | `95efcbd`（release） |

**范围说明**：H2 的 random 档语义为「每次聚焦重建时随机一次」而非全天稳定洗牌——这是刻意取舍（队列重建频率低、rng 注入保证可测），已在逻辑树 §5.2 注明。H2 的 favoriteFirst 受 favorite 表粒度（entry_id 级）约束，语义为词条级优先而非义项级，已如实披露于上表。

## §2 验收证据

- **门禁**（2026-10-05 本报告撰写会话实跑）：`pnpm lint` 0 问题（exit 0，expo lint）、`pnpm typecheck` 干净（exit 0，tsc --noEmit）、**vitest 151/151 通过（14 文件，422ms，exit 0）**：merge-core 14 / stats-core 45 / quiz-core 11 / morpheme-core 8 / queue 8 / rating-core 7 / fsrs-core 13 / search 14 / upstream-core 4 / learning-core 5 / mode-core 3 / theme-core 5 / order-core 11 / upgrade 3
- **用例账目**（M-G 整改后 138 → M-H 151，+13，逐 commit 可溯）：H1 fsrs-core 原「keeps only due cards and respects the daily limit」单上限用例改写为仅复习上限用例 + 新增双上限用例「caps due review cards by reviewLimit and new cards by newLimit, reviews first」（12→13，新用例含 3 个断言场景）、merge-core 补旧版备份回填用例「backfills daily_goal new columns for legacy backups (min(target_count,5) / 0)」（13→14）（`09af8c8`）→ H2 新增 order-core 11 例（parseNewCardOrder 三档解析回退 + orderNewCards 恒 0/恒 0.5 固定随机源确定性输出等）（`6bb6933`）
- **产物**：`dist/wordfolio-0.1.0-beta.22-arm64.apk`（40,508,151 B，2026-10-05 23:13），已含全部 M-H 改动；本切片 aapt2（build-tools 36.0.0）复核 versionName 一致
- **代码闭环**：H2 新增纯函数模块 order-core 无 RN 依赖、配 vitest 文件；新增 SQL 全参数绑定（getSeedCandidates 仅 LIMIT ? 占位），无字符串拼接，符合 Mimosa「外部输入必须参数绑定、不得拼接」约束；零新增依赖（`git diff --name-only 47cb134..95efcbd` 无 package.json）
- **逻辑树核对与更新**（本切片执行）：头部版本行 beta.21→beta.22（M-H 调度体验）；§3.1 daily_goal 行补 new_target/new_completed 双列与写入方、settings 行补 newCardOrder 键；§5.2 今日队列补双上限/先复习后新学/补卡三档顺序语义（含 random 一次性语义与 gather 作用边界）；§5.4 FSRS 参数表补注：每日目标为产品层队列上限、不属于 FSRS 参数，本表冻结状态不变；§4 屏级规格学习/统计两行的取数与写入描述同步；§7 组件清单补 order-core 行并更新 fsrs-core/merge-core/stats-core 用例计数。（注：任务说明称更新「§5.3/§5.4」，实际逻辑树 §5.3 为真人发音链，双目标拆分与先复习后新学、新卡顺序语义的内容归属是 §5.2 今日队列，按内容落位并在此说明）

## §3 测试证据

- 本地三道门禁为数字出处（本会话实跑命令：`pnpm lint`、`pnpm typecheck`、`pnpm test`；vitest Test Files 14 passed (14)、Tests 151 passed (151)，422ms，三命令 exit 均 0）
- CI：M-H 区间 3 个 commit 均未 push（延续 M-F 以来未推送状态），远端 CI 未及验证；push 后以 CI 为准
- 实机冒烟（beta.22，emulator-5554，切片当时执行、截图 22 张存在于 `dist/smoke-beta22/`，本报告切片核对截图存在性、未重跑）：
  - ✅ 环境 + 升级路径：AVD wordfolio_test（Android 15）复用，beta.21 基线数据（累计复习 6 次/连续 2 天/自由练习 3 次/每日目标 30）覆盖安装 beta.22 后全部保留，learning.db 迁移无崩溃、无数据丢失；`am start` 启动正常，`logcat -d -s AndroidRuntime:E CRASH:E` 全程 0 条 FATAL（`00-preupgrade-beta21.png`、`01-preupgrade-stats-beta21.png`、`02-postupgrade-launch.png`、`03-upgrade-data-check.png`）
  - ✅ a 目标编辑拆两项：统计页「每日目标」拆复习目标（10/20/30/50）与新学目标（5/10/20/30）两行，升级后默认复习 30、新学 5；点选后顶部计数与提示文案即时更新，两项独立保存、杀进程重启后保留（`h1-goal-split.png`）
  - ✅ b 进度文案双目标 + 分类计数：学习页「今日 复习 3/20 · 新学 0/10 · 剩 11」分列式文案；评复习卡复习 +1、评新卡新学 +1，计数与卡型对应正确（`h1-progress.png`、`h1-progress-after-review.png`、`h1-progress-newcard-graded.png`）
  - ✅ c 队列先复习后新学：36 张到期复习卡 + 新学目标 10 场景下，首卡为复习卡（标注「复习 1 次」），复习全部排在新卡之前（`h1-review-first.png`）
  - ✅ d 收藏优先：词库页收藏 a/in/i 三词条后，统计页切「收藏优先」，学习页此后新卡依次为收藏词条「a」（维生素A 义项）与「in」（adv. 向内）（`h2-favorites-marked.png`、`h2-favorite-first-setting.png`、`h2-favorite-first.png`）
  - ✅ e 回归：四档/三档评分键切换正常（测试后已恢复专家模式）；热力图近一年格子正常渲染；压力卡 7 天/30 天切换正常（7 天视图今日到期 36 张）；复习历史日/周/月三档切换正常（日档 10-04=6/10-05=7 与实际评分一致，周档 W40=6/W41=7）（`h2-regression-*.png` 系列 9 张）。注：验证三档时误触「每日提醒」弹出系统通知权限框，已选 DON'T ALLOW，每日提醒开关保持关闭未改变
- **未做**：iOS 侧验证（ADR-0006 暂停中）；真机（非模拟器）验证未做；random 档的真机观感（非固定随机源）未单独冒烟（rng 确定性由单测覆盖）

## §4 质量事故与修复

| 事故 | 根因 | 修复 | 教训 |
|---|---|---|---|
| 无 fix/revert commit | M-H 区间（`47cb134..95efcbd`）3 个 commit，无 fix/revert（`git log --oneline` 实测） | — | — |

本区间无入库事故。两处非事故事项如实留档：① H2 需求说明称 favorite 表为 stable_id 级，与现实 schema（entry_id 级）不符，切片内按现实调整语义并披露（见 §1 范围说明）；② 冒烟中误触每日提醒弹出系统通知权限框并拒绝，属验证操作插曲，应用设置未受影响（每日提醒本就保持关闭）。

## §5 ADR 清单

- ADR-0005 客户端技术栈（Accepted，T0）——H1 schema 迁移在 learning.db（设备端可写库）内 try-ALTER 完成，不触碰 wordfolio.db 只读发布物边界
- ADR-0006 发布策略——Android beta 先行、iOS 暂停（Accepted，2026-09-29）
- M-H 期间无新增 ADR；FSRS（ts-fsrs v5）对经典 SM-2 的取舍记录于 M-D 与功能逻辑树 §5.4；favorite 粒度（entry_id 级）与 newCardOrder 三档语义记录于功能逻辑树 §3.1/§5.2 及各 commit message

## §6 AI 使用披露

- M-H 区间 3 个 commit（`09af8c8` 双目标拆分、`6bb6933` 新卡顺序、`95efcbd` release bump）全部由 AI 代理执行，用户以「签收」把关
- 本报告由 AI 文档收尾切片撰写：§2 门禁数字（lint/typecheck/vitest 全量 151）、aapt2 versionName 复核、逐文件用例计数、改动文件清单（`git diff --stat`）、§7 所列代码行核读为该会话实跑实读；各切片范围描述与冒烟 6 场景细节引自对应切片交付说明，其中代码行号引用、截图存在性（`dist/smoke-beta22/` 22 张）、测试计数已由本切片抽查复核（见 §7）

## §7 抽查审计记录

- **H1 双上限与复习在前**：`buildTodayQueue`（`fsrs-core.ts:102`）签名 `(cards, reviewLimit, newLimit, now)`，`fsrs-core.ts:110-114` 到期卡按 state 拆两段各自 `slice` 截断、各自 `sortForQueue`，review 段在前拼合——实读与声明一致。行号勘误：H1 切片交付说明称 buildTodayQueue 落 `fsrs-core.ts:98`，实读声明在 `:102`（`:100` 为语义注释），本报告按实读行号记账
- **H1 schema 迁移**：建表语句新列 `study.ts:71-72`；try-ALTER 回填 `study.ts:79-92`（成功路径 `UPDATE daily_goal SET new_target = min(target_count, 5)`，注释说明取舍），与「升级后日总量最多 +5、new_completed 归零」的声明一致
- **H2 favorite 粒度**：`src/db/study.ts:29-32` favorite 表 `entry_id INTEGER PRIMARY KEY`，`getFavoriteEntryIds`（`study.ts:99`）返回 entry_id——确认切片偏离说明属实，favoriteFirst 为词条级语义
- **H2 补卡链路**：`getSeedCandidates`（`repository.ts:275`）返回含 freq_rank/entry_id 元数据的候选；`getSeedSenseIds`（`repository.ts:291-292`）为委托包装；学习页候选池 `goal.newTarget * 4` + favorite 集合合流（`study.tsx:136-142`）；`parseNewCardOrder`（`order-core.ts:21`）/`orderNewCards`（`order-core.ts:61`）均存在且导出
- **H2 竞态防护共用**：`stats.tsx:98-100` newCardOrder 状态与「ratingMode 与 newCardOrder 两个偏好共用」守卫注释、`stats.tsx:322,337` 三段 segChip 选中态与 hint 渲染实读一致
- **门禁与产物复核**：本切片实跑 `pnpm lint`（0 问题）/ `pnpm typecheck`（干净）/ `pnpm test`（14 文件 151 用例全过，422ms）；aapt2（build-tools 36.0.0）dump badging 确认 `versionName='0.1.0-beta.22'`；`dist/smoke-beta22/` 22 张截图存在性逐一核对
- **安全 hook 合规**：M-H 新增 SQL 全参数绑定（getSeedCandidates 仅 LIMIT ? 占位）、零新增依赖（改动清单无 package.json）、无新增网络请求面
- **网络红线**：H1/H2 均为本地库 schema/队列/偏好改造，无新增网络请求面

## §8 下一阶段建议（签收后）

开放债务（承接 M-G 报告 §8 清单，均仍未清偿、维持原状）：

- **词根词缀数据灌入（最大外部依赖）**：上游 M2-T09 启动后向 morpheme/entry_morpheme 灌数、随发布物下发，F2 区块即自动显现（无需改码）；届时需补一次有数据路径的真机冒烟（M-F 冒烟 c 的补考），并抽查 kind 分布与排序正确性
- **iOS**：ADR-0006 暂停中，恢复时补验评分模式/统计（聚焦刷新、热力图、压力卡）/复习历史周月切换/双目标与新卡顺序 iOS 侧行为
- **OTA**：EAS Update（channel: beta）预留未启用，作为热修候补通道评估
- **FSRS 参数**：request_retention 0.9 冻结至内测数据回收（逻辑树 §5.4）；专家模式四键回收的自评分布数据可作为将来调参输入
- **双商店**：注册 Google Play 开发者账号后走公测轨道；beta.22 APK 已就绪可直发内测群
- **评分模式数据观察**：内测期观察三档/专家模式使用占比；G3-② 竞态修复与 M-H 的 prefWrite guard 共用改造后，「写失败」路径的下次聚焦对齐行为可在内测中观察确认

新增下轮候选（本切片对齐 Anki 语义后显形）：

- **完整筛选队列/自定义牌组**（Anki filtered deck / custom study 语义）：自选条件（收藏、错题、tags、日期范围等）组建临时队列、可独立调度或归还原队列。本仓现有收藏优先补卡仅覆盖其一小部分意图；错题本（/wrong）已具备部分候选来源，若立项需先在功能逻辑树 §6 落槽位评审信息架构，再动队列层

## 放行签字（G3 适配）

- [ ] 用户验收（Milestone Owner）：＿＿＿＿
- [ ] 安全复核：＿＿＿＿（M-H 区间零新增依赖、新增 SQL 全参数绑定、无新增网络请求面；本报告不据此宣称项目安全状态；最近一次 Mimosa deep 扫描归档 `docs/security/2026-09-29-mimosa-deep-scan.md`）
