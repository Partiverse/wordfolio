# M-I 里程碑报告：自由练习范围筛选 / 轮内错题重试（Anki custom study 对照）

日期：2026-10-06 ｜ 状态：**待签收** ｜ 计划来源：移动端开发计划（2026-09-28 批准）M-I 自由练习增强切片（I1–I2）

> 报告骨架沿用 M-H 报告（§1–§8，源出 partisync-milestone-report 技能）；本仓为 Expo 项目，机器门禁以 pnpm 三件套 + 实机冒烟替代 cargo 体系。与 M-H 不同，本切片主题是自由练习侧的范围筛选与轮内重试，故 §1 以「Anki custom study 对照表」开篇，随后为范围与结果表。

## §1 Anki custom study 对照表

M-H 已将 Anki 队列构建层的每日双上限、复习优先、gather order 三项语义在本仓对齐（见 M-H 报告 §1）；Anki 的 **filtered deck / custom study** 一族当时仅部分覆盖、列为下轮候选。本切片（I1/I2）将其中两项以「自由练习」的轻量形态落地，对照如下：

| Anki 概念 | Anki 语义 | 本仓对应 | 对齐状态 |
|---|---|---|---|
| filtered deck / custom study | 按标签/牌组/到期状态等条件临时组队（收藏重学、考前突击等），可独立调度或归还原队列，正式学习与复习均可用 | I1：练习范围筛选四档（全部/收藏/考试/CEFR 五档），学习屏练习/听音/拼写模式范围 segChip 行，抽题池由「已学卡全集」缩为「范围 ∩ 已学卡」，偏好落 settings（`practiceScope`/`practiceCefr` 两键）；**练习语义不动排期**——范围只约束抽题池，作答仍只写 review_log(kind='practice')，不碰 review_card/daily_goal | **部分对齐**（`168ba0e`）——条件固定四类、仅作用于自由练习抽题池；无自选条件组建、无独立调度/归还原队列语义，完整筛选牌组仍未做（见 §8）。**已知缺陷**：收藏范围查询 SQL 漏列别名致池恒为 0（`repository.ts:335`，冒烟 b 项 FAIL，见 §3/§4），修复列 §8 首项 |
| relearn steps within custom study | 筛选牌组内答错卡进入重学步骤、轮内重现，且按重学排期影响后续调度 | I2：轮内错题重试 `retryWrong`——答错卡尾插队末、每卡每轮最多重试一次、`retriedSet` 记账（兼「本轮答错 x」计数），hint 有重试才显示；**不写排期的轻量版**——重试作答仍只写 review_log(kind='practice')，不入正式重学队列、不触发 FSRS 重排 | **轻量对应**（`0d576b4`）——与 Anki 重学队列的本质差异即在此：本仓重试只是「本轮稍后再来一次」，轮结束即消失。已知边界：队尾答错卡「移到队尾」不改变顺序、本轮不重显（QuizCard 以 stableId 作 key 不重挂载、卡在已答状态无法作答，`src/components/QuizCard.tsx:33-34`），该卡仍计入答错计数但无重试 |

### 范围与结果表

M-I 区间（`badf53d..9187cee`）3 个 commit（I1 范围筛选、I2 错题重试、release beta.23）。src+tests 6 文件 +528/−12，release commit 仅 app.json 1 行（`git diff --stat badf53d..9187cee` 实测，未触碰 android/、ios/ CNG 生成物，package.json 零改动）。

| 切片 | 范围 | 实现要点 | 证据 commit |
|---|---|---|---|
| I1 练习范围筛选 | 自由练习（练习/听音/拼写）抽题池按范围档位收窄：全部/收藏/考试/CEFR 五档 | ① 新增纯函数模块 `src/study/scope-core.ts`：两键常量 `PRACTICE_SCOPE_KEY`/`PRACTICE_CEFR_KEY`（`scope-core.ts:6,9`）、四档 `PRACTICE_SCOPES`（`:11`）、五档 `PRACTICE_CEFR_LEVELS`（`:27`）、`parsePracticeScope`/`parsePracticeCefr`（`:32,40`，无效值分别回退 'all'/'A1'，'C2' 视为无效回退——当前发布物 C2 为 0 条，上游带数据时扩常量即可）。② `queue.filterPracticeScope`（`queue.ts:55`）：scope 集合 null/undefined 直通副本（scope='all'），否则按 stableId 命中过滤、保持相对顺序，不改入参；与 pickPracticeRound 组合即完整抽题管线。③ repository 三个范围 stable_id 查询：收藏经 learning.db favorite entry_id → `getStableIdsForEntries`（`repository.ts:327`，按 500/批分片参数化 IN，规避 SQLite 变量上限 999）；考试 `getExamScopeStableIds`（`:344`，JOIN exam_tag）；CEFR `getCefrScopeStableIds`（`:355`，WHERE e.cefr = ? 参数绑定）。**关键决策**：a) 「已学」取宽口径 review_card 全集（含本次聚焦新补、尚未评分的 New 卡）——现状 pickPracticeRound(all) 本就含新补卡，范围筛选只加约束不减功能；且每次评分 reps+1，reps>0 与 state!==New 等价，口径差异仅在这批未评新卡；b) 三个范围在发布物侧都是**词条级**条件（exam_tag 实查 schema 为 PRIMARY KEY (entry_id, tag)、cefr 挂 entry、favorite 是 entry_id 级），语义统一为「范围内词条的全部义项」，未用 sense.cefr（`sqlite3 assets/db/wordfolio.db ".schema exam_tag"` 本报告切片实查）；c) 跨库求交选 JS 侧：发布物只出范围集合全集（规模有界：exam 108 词条、单档 CEFR ≤328 词条、收藏用户自选），与已学卡交集由 filterPracticeScope 完成；d) CEFR 取有数据的五档 A1/A2/B1/B2/C1（发布物实查 A1 328/A2 93/B1 19/B2 10/C1 1、C2=0），不渲染空档。④ 学习屏（study.tsx）：范围行仅 quizMode 渲染（`:474` 起），CEFR 档追加二级 chips；切档即写 settings 并立即重建本轮（不等重聚焦）；重建 effect（`study.tsx:281`）以 learnedCards/scope/cefrLevel/scopeEpoch 为依赖统一计算池与轮，抽中卡补拉 getStudySenses 合并（范围池常含今日队列之外的卡）；池不足一轮显示「该范围共 x 张」hint（`:525`）；聚焦恢复走 `scopeWriteSeqRef`/`scopeWritePendingRef` G3 守卫（`:127-128`，两键共用一组序号，同 stats.tsx 模式，`:221` 判定）。⑤ 顺带修两个既有暗坑（非需求但范围化后必然踩到）：练习池原只取今日队列的义项内容，池中今日队列外的卡渲染成无限 spinner——重建 effect 现补拉合并；0 已学卡时切练习模式原也是无限 spinner——新增空池空态文案（`:543`）。⑥ 备份自动携带零改动：merge-core validateSettingRow 对 settings key 仅 reqString 校验、无白名单（`merge-core.ts:215-222`），新键随五表全量导出/按 key 合并导入 | `168ba0e` |
| I2 轮内错题重试 | 练习模式答错卡轮内尾插重现一次（不写排期的轻量重学） | `queue.ts` 新增纯函数 `retryWrong`（`queue.ts:83`）返回 `{ queue, retried, moved }`：答错卡尾插（`queue.ts:95-97`）、每卡每轮最多重试一次（retriedSet 已有则 no-op，`:88-90`）、stableId 不在队内安全 no-op（`:91-93`）、moved=队列顺序是否真的变了（`:100`，`index !== queue.length - 1`）。**签名超集说明**：ask 只要求返回新队列与新 retriedSet，但调用方无 moved 无法区分「尾插成功」与「no-op」，会错跳或漏跳一张——首错尾插时当前卡移走、下一张自动落位到原 index（游标保持），moved=false（二错/队尾/不在队内）时游标 +1 跳过，与旧行为一致。study.tsx `answerPractice(false)` 接入（`study.tsx:394`）：`setPracticeIndex((i) => (res.moved ? i : i + 1))`；重试作答同样只走 review_log(kind='practice')（answerPractice 现有写库调用未动），未触碰 review_card/daily_goal，flip 正式学习模式代码零改动。练习区新增「本轮答错 x」hint（`:529`，有重试才显示，同卡重试后再错不重复累计）；「再来一轮」按轮清零（`:561`）；practiceFinished 判定与轮完成逻辑零改动（尾插不改变队列长度）。已知边界（如实说明）：答错卡若已是队内最后一张，「移到队尾」不改变顺序、本轮不再重显该卡（同卡原位重显会因 QuizCard 以 stableId 作 key 不重挂载、卡在已答状态无法作答），该卡仍计入「本轮答错」但无重试；其余位置的答错卡都保证轮内获得一次重试。配 7 条 vitest 单测（尾插、保持其余卡相对序、二错不重排不累计、不存在的 stableId 安全 no-op、队尾卡只记账、多卡连错各自尾插、不改入参） | `0d576b4` |
| V1 beta.23 构建与冒烟 | 构建 + 覆盖安装 + 6 项冒烟（升级路径 + I1 范围 chips/出题 + I2 错题重试 + 回归） | dist APK `wordfolio-0.1.0-beta.23-arm64.apk`（40,520,907 B，2026-10-06 11:49）；aapt2 dump badging 复核 `versionName='0.1.0-beta.23'`、`com.partiverse.wordfolio`（本报告切片实跑）。模拟器 emulator-5554（AVD wordfolio_test 复用）beta.22 → beta.23 覆盖安装升级数据保留 + 6 项冒烟 **5 过 1 FAIL**（详见 §3），截图 8 张 `dist/smoke-beta23/`。FAIL 项为 I1 收藏范围池恒 0（功能缺陷，见 §4），其余含 CEFR 范围出题、错题重试全链路 review_log 铁证均通过 | `9187cee`（release） |

**范围说明**：I1 的「范围 ∩ 已学卡」中「已学」为宽口径（review_card 全集，含未评新卡），已在范围表 I1 行注明理由；I1 冒烟仅验证了 CEFR 档出题正向路径（按「考试或 CEFR」的「或」），收藏与考试范围的**正向出题**未验证——收藏因缺陷 FAIL，考试范围设备数据下池为 0（已学 40 卡词头与 exam_tag 交集 0，属合理空池非 bug）。I2 的队尾卡边界与 moved 签名超集均已如实披露于上表。

## §2 验收证据

- **门禁**（2026-10-06 本报告撰写会话实跑）：`pnpm lint` 0 问题（exit 0，expo lint）、`pnpm typecheck` 干净（exit 0，tsc --noEmit）、**vitest 168/168 通过（15 文件，595ms，exit 0）**：fsrs-core 13 / quiz-core 11 / rating-core 7 / morpheme-core 8 / search 14 / stats-core 45 / merge-core 14 / queue 20 / order-core 11 / learning-core 5 / scope-core 5 / upstream-core 4 / theme-core 5 / mode-core 3 / upgrade 3
- **用例账目**（M-H 整改后 151 → M-I 168，+17，逐 commit 可溯）：I1 新增 scope-core 5 例（parsePracticeScope/parsePracticeCefr 三档/五档解析与回退）+ queue 新增 filterPracticeScope describe 5 例（null/undefined 直通副本、命中过滤保序、空集回空、不改入参、与 pickPracticeRound 组合管线）（`168ba0e`）→ I2 queue 新增 retryWrong describe 7 例（见范围表 I2 行）（`0d576b4`）
- **产物**：`dist/wordfolio-0.1.0-beta.23-arm64.apk`（40,520,907 B，2026-10-06 11:49）；aapt2（build-tools 36.0.0）dump badging 确认 `versionName='0.1.0-beta.23'` 一致（本报告切片实跑）。**注意**：该包含 I1 收藏范围缺陷（冒烟 b 项 FAIL，§4），内测直发建议等修复重打包后（见 §8 首项）
- **代码闭环**：I1 新增纯函数模块 scope-core 与 queue.filterPracticeScope/retryWrong 均无 RN/SQLite 依赖、配 vitest 文件；新增 SQL 全参数绑定（getStableIdsForEntries 500/批分片 `?` 占位、getCefrScopeStableIds `WHERE e.cefr = ?`），无字符串拼接值，符合 Mimosa「外部输入必须参数绑定、不得拼接」约束；跨库求交在 JS 侧完成，发布物侧仅只读查询；零新增依赖（`git diff --name-only badf53d..9187cee` 无 package.json）
- **逻辑树核对与更新**（本切片执行）：头部版本行 beta.22→beta.23（M-I 自由练习增强）；§2 学习线包含项与衔接点补范围筛选/错题重试语义（仍只写 kind='practice'）；§3.1 settings 行补 practiceScope/practiceCefr 两键；§4 学习屏行读/写/特殊三栏同步（范围 chips、池 hint、空池空态、答错 hint、G3 守卫）；§5.2 自由练习段补范围筛选与轮内错题重试语义（含宽口径已学、词条级范围语义、队尾卡边界）；§6 槽位表新增两行已交付记录并注记词书选择行的练习侧覆盖；§7 组件清单补 scope-core 行、queue 行职责与用例数更新（4→20）

### 五轴代码复核与整改（2026-10-06 复核会话，签收前置）

- **冒烟 b 项缺陷已修**：根因为 `getStableIdsForEntries`（`src/db/repository.ts:335`）SQL 漏 `AS stableId` 列别名，`rows.map(r => r.stableId)` 全 undefined → 收藏 scopeSet 空集 → 池恒 0（同文件 exam/CEFR 查询带别名故正常，差异吻合）。修复一行 + sqlite3 验证；冒烟员逐项对照全部新查询无同类别名残留（复核员二次确认）
- 两切片并行外派独立评审：
  - I1 `168ba0e`：**Approve**。别名修复验证正确；全部新 SQL 列名/别名与类型断言逐一对照无残留；空集语义正确（空 Set → 空池 + 空态 hint 一致，不会误判「无收藏=无限制」）；重建时机无双拉/漏拉（React 19 批处理）；G3 守卫两键共用序号 node 时序推演正确、与统计页无 key 冲突；C2 存量值回退 A1 有测试锁定。留档：重建 effect 裸 catch 把 DB 故障呈现为空态（Optional）、DISTINCT 冗余（Nit）。
  - I2 `0d576b4`：**Approve**。retryWrong 六场景 node 全轮走查无偏差（首错尾插游标保持、队尾卡只记账、二错不重排、retriedSet 三处生命周期闭环）；QuizCard 重试重挂载可正常作答；重试作答再记 practice log 与功能逻辑树 §8 打卡语义一致（有意设计）。留档：答错反馈延时窗口 × 重建竞态（既有模式延伸，Optional）、错题本「练习答对即订正」语义可辩（既有设计，FYI）。
- 顺手采纳：补「非空范围集合零交集 → 空池」测试锁（queue.test.ts）。未采纳留档：I1 错误态区分、hint 常显（产品意图待定）等 Optional 项
- 整改后门禁复跑（复核会话实跑）：`pnpm lint` / `pnpm typecheck` 0 问题，**vitest 169/169（15 文件）**，较上文 168 的 +1 为零交集用例；上文 168 为整改前快照，以本节 169 为准
- **beta.23 apk 已修复后重打**（40,520,919 B，2026-10-06 12:42，aapt2 复核 versionName 一致），上文 40,520,907 B（11:49）为缺陷包，内测以重打包为准
- **冒烟复考（12:42 重打包）**：收藏范围正常出题——11 次抽词 100% 落在收藏集 {a,in,i,it,on,be}、答题判定正确、错题重试顺带复验（答错计「本轮答错 1」）；截图 `i1-fav-scope-fixed.png` / `i1-fav-round-complete.png` / `i1-all-scope.png`。§3 原 b 项 FAIL 记录保留为历史事实，修复已由复考闭环；「该范围共 N 张」hint 为不足一轮/空态专属，非空范围不渲染（符合实现语义，字面验收项不可达）

## §3 测试证据

- 本地三道门禁为数字出处（本会话实跑命令：`pnpm lint`、`pnpm typecheck`、`pnpm test`；vitest Test Files 15 passed (15)、Tests 168 passed (168)，595ms，三命令 exit 均 0）
- CI：M-I 区间 3 个 commit 均未 push（延续 M-F 以来未推送状态），远端 CI 未及验证；push 后以 CI 为准
- 实机冒烟（beta.23，emulator-5554 AVD wordfolio_test 复用——新起第二实例报 FATAL 'Running multiple emulators with the same AVD'，属环境插曲非应用问题；切片当时执行、截图 8 张存在于 `dist/smoke-beta23/`，本报告切片核对截图存在性、未重跑）：
  - ✅ 环境 + 升级路径：beta.22 基线（收藏 badge=3、统计页 累计复习 10 次/自由练习 3 次/连续 2 天/已稳固 0）覆盖安装 beta.23 后全部一致，收藏 6 词条仍在；`adb install -r` → Success，dumpsys versionName=0.1.0-beta.23；全程 `logcat -b crash` 0 条 wordfolio/FATAL，app 进程存活
  - ✅ 前置准备：词库页收藏 it/on/be（badge 3→6，favorite 表实插 entry_id 4/5/6，adb root 后 sqlite3 直查确认合计 6 条）；卡片模式评分 3 张（简单/认识/简单），计数变「复习 2/20 · 新学 1/5 · 剩 5」
  - ✅ a 范围 chips：练习模式可见「练习范围：全部/收藏/考试/CEFR」四 chip；点 CEFR 出现「CEFR 档位：A1/A2/B1/B2/C1」五档二级 chips（无 C2，与需求一致），A1 默认选中并自动建轮（`i1-scope-chips.png`）
  - ❌ **b 收藏范围练习（FAIL）**：收藏范围练习池恒为 0，UI 显示「该范围共 0 张」「「收藏」范围内共 0 张已学卡」，冷重启复现（确定性）；而设备数据 favorite 6 条、review_card 40 条、发布库 `SELECT DISTINCT stable_id FROM sense WHERE entry_id IN (1..6)` 返回 31 条，交集 ≥8，池不应为 0。根因（源码实读佐证）：`src/db/repository.ts:335` SQL `SELECT DISTINCT stable_id FROM sense WHERE entry_id IN (...)` 缺 `AS stableId` 列别名，`:338` `rows.map(r => r.stableId)` 全为 undefined → scopeSet 空集 → filterPracticeScope 结果 0；同文件 exam 查询（`:347`）与 CEFR 查询（`:359`）均带别名、CEFR 实测正常，差异吻合（`i1-fav-scope.png`，收藏列表对照 `i1-fav-list.png`）。**「抽到的词都是收藏词条」正向验证因缺陷未完成**
  - ✅ c 考试或 CEFR 范围出题（按「或」取 CEFR 验证）：CEFR·A1 轮正常出题（本轮 0/10，出卡四选一可推进）；附带观察：「考试」范围池为 0（空态文案），属合理空池非 bug——已学 40 卡词头（a/in/i/it/on/be/as/are/have）与 exam_tag（108 词条）在设备 SQL 交集为 0（`i1-exam-or-cefr.png`）
  - ✅ d 轮内错题重试：CEFR·A1 轮内对卡 i（i.1.n.2）故意答错，hint「本轮答错 1」即时出现（`i2-retry-wrong.png`）；该卡尾插队末（队列保持 10 张）；依次答对其余 9 张后该卡作为最后一题重现并被答对——review_log 铁证：id17 i.1.n.2 rating=1 → id18-26 九张 rating=3 → id27 i.1.n.2 rating=3，同卡两次作答；轮完成画面「本轮 10/10 · 本轮答错 1 · 本轮练习完成 · 已练 10 个义项 · 再来一轮」（`i2-retry.png`）
  - ✅ e 回归：卡片模式 revealed 后四档评分键认识/简单/模糊/忘记全部渲染并可点击推进；统计页六张卡正常且数值随操作正确变化（自由练习 3→14、连续 3 天、累计复习 13 次等）（`regression.png`、`regression-stats.png`）
- **未做**：I1/I2 实现切片未做模拟器 UI 实测（由 beta.23 冒烟切片覆盖）；iOS 侧验证（ADR-0006 暂停中）；真机（非模拟器）验证未做；收藏/考试范围的正向出题冒烟未完成（收藏因 §4 缺陷 FAIL、考试因设备数据池为 0 无从抽题）

## §4 质量事故与修复

| 事故 | 根因 | 修复 | 教训 |
|---|---|---|---|
| beta.23 冒烟发现功能缺陷：I1「收藏」练习范围池恒为 0（无 fix commit，**未修复**） | `getStableIdsForEntries` 的 SQL（`repository.ts:335`）`SELECT DISTINCT stable_id FROM sense WHERE entry_id IN (...)` 漏 `AS stableId` 列别名；expo-sqlite 按原始列名 `stable_id` 返回行，`:338` `rows.map(r => r.stableId)` 全 undefined → scopeSet 空集 → 池 0 | 尚未修复。修复方案：补 `AS stableId` 别名（对齐同文件 exam `:347`/cefr `:359` 查询写法）+ 补该函数返回值映射的单测/冒烟复测收藏范围正向用例 + 重打 apk | ① 同文件三个查询两带别名一不带，说明是遗漏而非模式——新查询应与同文件既有写法逐字对照；② TS 类型标注 `{ stableId: string }` 骗过了编译期，类型标注不能替代运行时列名核对（无别名的 snake_case 列不会自动映射 camelCase）；③ 冒烟正向用例（b 项）正是为拦这类「编译过、类型对、运行空」的缺陷而设——本轮它拦住了 |

本区间无入库 fix/revert commit（`git log --oneline badf53d..9187cee` 实测 3 个 commit，无 fix/revert）；上述缺陷发现于 beta.23 冒烟、报告时点代码仍在，如实留档为开放缺陷（修复列 §8 首项）。两处非事故事项如实留档：① 冒烟尝试新起第二模拟器实例报 FATAL（同 AVD 冲突），复用现有实例后全程正常，属环境操作插曲；② 「考试」范围池为 0 是设备数据事实（已学词头与 exam_tag 无交集），空态文案正确呈现，非 bug。

## §5 ADR 清单

- ADR-0005 客户端技术栈/本地优先零后端（Accepted，T0）——I1 范围集合查询只读发布物（wordfolio.db），与 learning.db 已学卡的求交在 JS 侧完成，未触碰「发布物只读」边界；收藏范围经 learning.db favorite entry_id 关联后再查发布物义项，两库职责不变
- ADR-0006 发布策略——Android beta 先行、iOS 暂停（Accepted，2026-09-29）
- M-I 期间无新增 ADR；范围语义的三个决策（宽口径已学、词条级范围语义、JS 侧求交）记录于功能逻辑树 §5.2、本报告 §1/§2 与 commit message；I2 的 moved 签名超集与队尾卡边界记录于 queue.ts 头注与本报告 §1

## §6 AI 使用披露

- M-I 区间 3 个 commit（`168ba0e` 范围筛选、`0d576b4` 错题重试、`9187cee` release bump）全部由 AI 代理执行，用户以「签收」把关
- 本报告由 AI 文档收尾切片撰写：§2 门禁数字（lint/typecheck/vitest 全量 168）、aapt2 versionName 复核、逐文件用例计数、改动文件清单（`git diff --stat`）、§7 所列代码行核读、exam_tag schema 与 CEFR 分布的 sqlite3 实查、`dist/smoke-beta23/` 8 张截图存在性核对为该会话实跑实读；I1/I2 切片的关键决策与偏离说明、冒烟 6 场景细节引自对应切片交付说明，其中代码行号引用、schema 口径、缺陷根因已由本切片实读复核（见 §7）

## §7 抽查审计记录

- **I1 纯函数层**：`parsePracticeScope`（`scope-core.ts:32`，无效回退 'all'）与 `parsePracticeCefr`（`:40`，无效含 'C2' 回退 'A1'）实读与声明一致；`PRACTICE_CEFR_LEVELS` 五档注释（`:24-27`）与发布物实查分布（A1 328/A2 93/B1 19/B2 10/C1 1、C2=0）吻合；`filterPracticeScope`（`queue.ts:55`）null/undefined 直通副本、命中过滤保序，配 5 条单测
- **I2 纯函数层**：`retryWrong`（`queue.ts:83`）返回 `{ queue, retried, moved }`，`moved = index !== queue.length - 1`（`:100`）；retriedSet 去重记账（`:88-90` 二错 no-op）、不在队内安全 no-op（`:91-93`）、两分支均返回副本不改入参——实读与 7 条单测断言一一对应
- **I1 范围查询三兄弟**：`getStableIdsForEntries`（`repository.ts:327`）SQL（`:335`）确无 `AS stableId` 别名而 `:338` 取 `r.stableId`——冒烟 b 项 FAIL 根因实读属实；exam 查询（`:347`）与 CEFR 查询（`:359`，`WHERE e.cefr = ?` 参数绑定）均带别名，与「CEFR 正常、收藏恒 0」的冒烟差异吻合
- **UI 接线**：范围行仅 quizMode 渲染与 CEFR 二级 chips（`study.tsx:474` 起）；重建 effect（`study.tsx:281`）依赖 learnedCards/scope/cefrLevel/scopeEpoch、抽中卡补拉 getStudySenses 合并（切片声称的两个暗坑修复实读属实）；切范围/切档即写 settings + `scopeWriteSeqRef`/`scopeWritePendingRef` G3 守卫（`:127-128, :328, :340`，聚焦读判定 `:221`）；池 hint（`:525`）、答错 hint（`:529`）、空池空态（`:543`）、retryWrong 接入（`:394`，`res.moved ? i : i + 1`）
- **schema 实查**（本报告切片 `sqlite3 assets/db/wordfolio.db` 实跑）：exam_tag 为 `PRIMARY KEY (entry_id, tag)`、entry_id REFERENCES entry——词条级口径属实；`SELECT COUNT(DISTINCT entry_id) FROM exam_tag` = 108；entry.cefr 分布 A1 328/A2 93/B1 19/B2 10/C1 1——切片决策与数据吻合
- **备份自动携带**：`validateSettingRow`（`merge-core.ts:215-222`）对 settings key/value 仅 reqString 校验、无白名单——practiceScope/practiceCefr 零改动随备份往返属实
- **队尾卡边界引用核实**：`src/components/QuizCard.tsx:33-34` 注释「父层用 key={sense.stableId} 重挂载本组件」实读属实，队尾答错卡不原位重显的边界说明成立
- **门禁与产物复核**：本切片实跑 `pnpm lint`（0 问题）/ `pnpm typecheck`（干净）/ `pnpm test`（15 文件 168 用例全过，595ms）；aapt2（build-tools 36.0.0）dump badging 确认 `versionName='0.1.0-beta.23'`；`dist/smoke-beta23/` 8 张截图存在性逐一核对
- **安全 hook 合规**：M-I 新增 SQL 全参数绑定（分片 IN `?` 占位与 `WHERE e.cefr = ?`）、零新增依赖（改动清单无 package.json）、无新增网络请求面
- **网络红线**：I1/I2 均为本地库查询/队列/偏好/UI 改造，无新增网络请求面

## §8 下一阶段建议（签收后）

开放债务（承接 M-H 报告 §8 清单；「完整筛选队列」一项被本轮部分覆盖、更新如下，其余维持原状；另新增本轮冒烟产出的修复项置首）：

- **修复 I1 收藏范围 SQL 别名缺陷（新增，置首）**：`repository.ts:335` 补 `AS stableId` 别名 + 补 getStableIdsForEntries 列名映射用例 + 重打 apk 复测「收藏范围抽到的词都是收藏词条」（该正向用例自功能立项起从未验证成功，见 §3 b 项/§4）；顺手可对 repository 新查询与同文件既有别名写法做一次对照自查
- **词根词缀数据灌入（最大外部依赖）**：上游 M2-T09 启动后向 morpheme/entry_morpheme 灌数、随发布物下发，F2 区块即自动显现（无需改码）；届时需补一次有数据路径的真机冒烟，并抽查 kind 分布与排序正确性（维持原状）
- **iOS**：ADR-0006 暂停中，恢复时补验评分模式/统计/复习历史周月切换/双目标与新卡顺序 iOS 侧行为，**追加**练习范围 chips 与 CEFR 二级档、错题重试 hint 的 iOS 侧行为（维持原状 + 追加）
- **OTA**：EAS Update（channel: beta）预留未启用，作为热修候补通道评估（维持原状）
- **双商店**：注册 Google Play 开发者账号后走公测轨道；beta.23 APK 含 §4 缺陷，内测直发建议等修复重打包后（更新提示）
- **FSRS 参数**：request_retention 0.9 冻结至内测数据回收（逻辑树 §5.4）；专家模式四键回收的自评分布数据可作为将来调参输入（维持原状）
- **评分模式数据观察**：内测期观察三档/专家模式使用占比；「写失败」路径的下次聚焦对齐行为可在内测中观察确认（维持原状；I1 的 scopeWrite guard 与 ratingMode/newCardOrder 同模式，落库失败对齐行为一致）
- **完整筛选队列/自定义牌组（部分覆盖，更新）**：M-H §8 列为下轮候选，M-I 以「自由练习范围筛选」（I1）覆盖其最小闭环——固定四类条件（全部/收藏/考试/CEFR 档）∩ 已学卡、练习语义不动排期、轮内错题重试（I2）补齐「组队后答错重练」的轻量语义。与 Anki 完整语义的差距仍未做：自选条件组建（tags/日期范围/错题本来源等）、独立调度或归还原队列、正式学习侧可用。若立项完整版，仍需先在功能逻辑树 §6 落槽位评审信息架构，再动队列层

## 放行签字（G3 适配）

- [x] 用户验收（Milestone Owner）：已签收 2026-10-06（两切片五轴外派复核通过；§3 冒烟 b 项缺陷已修复 `fdb5fb1` 并重打 apk，复考 11 次抽词 100% 收藏集闭环，见 §2 复核小节）
- [ ] 安全复核：＿＿＿＿（M-I 区间零新增依赖、新增 SQL 全参数绑定、无新增网络请求面；本报告不据此宣称项目安全状态；最近一次 Mimosa deep 扫描归档 `docs/security/2026-09-29-mimosa-deep-scan.md`）
