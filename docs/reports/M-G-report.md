# M-G 里程碑报告：统计页聚焦刷新 / 复习历史周月聚合 / M-F 复核遗留清偿

日期：2026-10-05 ｜ 状态：**待签收** ｜ 计划来源：移动端开发计划（2026-09-28 批准）M-G 体验打磨切片（G1–G3）

> 报告骨架沿用 M-F 报告（§1–§8，源出 partisync-milestone-report 技能）；本仓为 Expo 项目，机器门禁以 pnpm 三件套 + 实机冒烟替代 cargo 体系。M-G 无竞品对照输入，§1 以范围与结果表开篇（G1–G3 逐片：范围、实现要点、证据 commit）。

## §1 范围与结果

M-G 区间（`bf8310a..67da8a1`）4 个 commit（G1 聚焦刷新、G2 周月聚合、G3 复核遗留清偿 + release beta.21）。src+tests 12 文件 +279/−47，release commit 仅 app.json 1 行（`git diff --name-only bf8310a..67da8a1` 实测，未触碰 android/、ios/ CNG 生成物，package.json 零改动）。

### 范围与结果表

| 切片 | 范围 | 实现要点 | 证据 commit |
|---|---|---|---|
| G1 统计页聚焦刷新 | 学完卡切回统计页即更新数字，不杀 app、不闪屏 | 统计页数据拉取从 mount-only `useEffect([])` 整体迁移为 `useFocusEffect(useCallback(...))`（`src/app/(tabs)/stats.tsx:84-121`），与学习屏聚焦恢复模式一致（`(tabs)/study.tsx:100`）；tabs 下首次聚焦即 mount，只保留这一套触发，无 mount+focus 双拉。`todayKey(new Date())` 在每次聚焦回调内重算，跨 UTC 午夜后切回统计页即得到新 day（bucketHistory/futureLoad/heatmapData 口径不变）。已有数据时刷新静默完成（loading 态本就以 `stats === null` 判定），不闪屏。顺带修正一处与新需求冲突的旧 error 行为：原 `loadError` 存在时整个内容区被替换为错误框（刷新失败会清掉已显示数据）；现改为首载失败（`!stats && loadError`）才显示错误框，刷新失败（stats 已有）在内容区顶部内联提示「统计刷新失败，以下为上次加载数据」，下次聚焦成功 `setLoadError(null)` 清除。数据层（`src/db/study.ts`）SQL 与各纯函数零改动，无需新增单测 | `732668e` |
| G2 复习历史按日/周/月切换 | 复习历史屏（/history）柱状卡新增 日/周/月 三段切换，默认日（现状不变），清偿逻辑树 §6 注明的「按周/月维度切换未做」 | 语义边界：既定窗口为近 30 日（逻辑树 §6 该槽位标注），周/月聚合在同一近 30 日窗口内做、不扩窗口。纯函数 `aggregateTrend(days, granularity)`（`src/study/stats-core.ts:227`）：输入 bucketHistory 补零后的连续逐日序列，按 ISO 周（周一起始，ISO 8601 标签 YYYY-Www，以本周四定 ISO 年，ISO 算法边界已用 node 预验证：2021-01-01→2020-W53、2024-12-30→2025-W01、2025-12-29→2026-W01）或自然月（YYYY-MM）分组求和，输出 `{label,start,end,count}`；空期补零由输入补零序列自然满足，首尾不完整周期照实（start/end 取窗口内实际贡献日），空数据返回 []。UI（`src/app/history.tsx:105-115`）：卡头右侧三段 Pressable（accessibilityRole="tab" + accessibilityState.selected），样式沿用 study 屏 modeChip 既有风格；日模式列标签维持「每 5 列+末列」稀疏显示，周/月列数少（≤6 列）全部显示（周 W40、月「10月」）；柱条复用原 dayCol/dayBarTrack 样式 flex:1 自适应。取数复用 `getReviewHistory(30)`，SQL 零改动 | `05f211d` |
| G3 M-F 复核遗留清偿 | 清偿 M-F 五轴复核全部 Optional/Nit：F1 魔法数字 + 竞态守卫（选择修复而非留注释）、F2 三 Nit，并补两条单测 | ① 主键高亮魔法数字：新增导出 `PRIMARY_GRADE: Grade = Rating.Good`（`src/study/rating-core.ts:10`，语义注释「主评分键/高亮锚点」），学习屏两处 `g === 3` 改为 `g === PRIMARY_GRADE`（`(tabs)/study.tsx:426,431`）；FSRS Rating 枚举 Again=1/Hard=2/Good=3/Easy=4，行为零变化。② 统计页评分开关竞态：写序号 + pending 双闸（`stats.tsx:75-78,141-158`）——`toggleExpertMode` 每次乐观切换自增 `ratingWriteSeqRef` 并置 `ratingWritePendingRef=true`，`setSetting` finally 时仅在无更新切换在途才清 pending；聚焦读发起时记 readSeq，resolve 时若序号已变或仍有在途写则放弃覆盖本地状态（仅 pending 不够——覆盖「聚焦读发起早于写完成」窗口需要序号；仅序号不够——覆盖「切换后立即切 tab、读先于写落库」窗口需要 pending）。语义偏离一处：原注释称落库失败「本次会话内仍生效」，修复后写失败时本次 UI 不回退、但下次聚焦读会以 DB 真值重新对齐（更符合 DB 真实状态），注释已同步改写（`stats.tsx:152-153`）。③ 注释路径：`repository.ts:165` `../db/morpheme-core.ts` → `./morpheme-core.ts`。④ 列表 key：`MorphemeCard.tsx:22` key 去掉 `-i` 后缀，直接用 `m.morpheme`（唯一性实证：sqlite3 查得 morpheme 表 `morpheme TEXT NOT NULL UNIQUE`，且 entry_morpheme 主键 (entry_id, morpheme_id) 防同词条重复关联）。⑤ localeCompare：`morpheme-core.ts:32` 固定 `'en'` locale。测试：rating-core.test.ts 补 `PRIMARY_GRADE` 断言（=Rating.Good 且两模式均含该键），morpheme-core.test.ts 补 en collation 用例（'A' 排 'b' 前，码点序会相反） | `747a8d0` |
| V1 beta.21 构建与冒烟 | 构建 + 安装 + 8 项冒烟（G1/G2 新功能 + G3 回归 + 稳定性） | dist APK `wordfolio-0.1.0-beta.21-arm64.apk`（40,499,583 B，2026-10-05 18:34）；aapt2 dump badging 复核 `versionName='0.1.0-beta.21'`、`com.partiverse.wordfolio`、arm64-v8a（本报告切片实跑）。模拟器 emulator-5554（AVD wordfolio_test）安装启动 + 8 项冒烟全过（详见 §3），截图 13 张 `dist/smoke-beta21/` | `67da8a1`（release） |

**范围说明**：G2 的周/月聚合为前端纯函数聚合（输入近 30 日补零序列），不新增 SQL、不扩查询窗口——这是对逻辑树 §6 该槽位既定「近 30 日」语义的沿用而非偏离。G3-② 为一处注释语义改写（落库失败从「本次会话内仍生效」变为「下次聚焦读以 DB 真值对齐」），已如实披露于上表。

## §2 验收证据

- **门禁**（2026-10-05 本报告撰写会话实跑）：`pnpm lint` 0 问题（exit 0，expo lint）、`pnpm typecheck` 干净（exit 0，tsc --noEmit）、**vitest 137/137 通过（13 文件，406ms，exit 0）**：stats-core 44 / rating-core 7 / morpheme-core 8 / search 14 / merge-core 13 / fsrs-core 12 / quiz-core 11 / queue 8 / learning-core 5 / theme-core 5 / upgrade 3 / upstream-core 4 / mode-core 3
- **用例账目**（M-F 129 → M-G 137，+8，逐 commit 可溯）：G2 aggregateTrend +6（`05f211d`）→ G3 rating-core PRIMARY_GRADE 断言 +1、morpheme-core en collation +1（`747a8d0`）。G1 与 G3 其余项无新增用例（G1 未动数据层与纯函数；G3 ①③④⑤ 为常量提取/注释/key/排序参数，已由既有 129 例覆盖）
- **单文件复跑**：`pnpm vitest run tests/stats-core.test.ts tests/rating-core.test.ts tests/morpheme-core.test.ts` 确认 59/59（stats 44 / rating 7 / morpheme 8，本报告切片实跑）
- **产物**：`dist/wordfolio-0.1.0-beta.21-arm64.apk`（40,499,583 B，2026-10-05 18:34），已含全部 M-G 改动；本切片 aapt2 复核 versionName 一致
- **代码闭环**：G2 新增纯函数 aggregateTrend 无 RN 依赖、配 vitest 文件；G1/G3 均零新增 SQL（`git diff bf8310a..67da8a1 -- src/db/study.ts` 为空，数据层只读复用），符合 Mimosa「外部输入必须参数绑定、不得拼接」约束
- **逻辑树核对与更新**（本切片执行）：本切片同步更新了功能逻辑树——头部版本行 beta.20→beta.21；§4 统计屏行补聚焦刷新与内联报错语义；§5.5 主键高亮改为引用 `PRIMARY_GRADE` 常量并注明竞态防护；§6 槽位表「复习历史完整曲线」行划掉「按周/月维度切换未做」注记（清偿 M-E/M-F 两轮报告注明的该条文档债）；§7 组件清单更新 stats-core（aggregateTrend，44 例）、rating-core（PRIMARY_GRADE，7 例）、morpheme-core（固定 en locale，8 例）

## §3 测试证据

- 本地三道门禁为数字出处（本会话实跑命令：`pnpm lint`、`pnpm typecheck`、`pnpm test`；vitest Test Files 13 passed (13)、Tests 137 passed (137)，406ms，三命令 exit 均 0）
- CI：M-G 区间 4 个 commit 均未 push（延续 M-F 以来未推送状态），远端 CI 未及验证；push 后以 CI 为准
- 实机冒烟（beta.21，emulator-5554，切片当时执行、截图 13 张存在于 `dist/smoke-beta21/`，本报告切片核对截图存在性、未重跑）：
  - ✅ 模拟器启动 + 安装 beta.21（约 100s boot，`adb install -r` → "Performing Streamed Install / Success"，`am start` 后 topResumedActivity 确认前台，词库页正常渲染；aapt versionName=0.1.0-beta.21）（`00-launch.png`）
  - ✅ a 聚焦刷新：基线统计页（今日已复习 1/30、累计 4 次、近 7 日今日柱 1、压力卡今日到期 38 张），学习页专家四键评分 2 张卡，仅 tab 切换（未杀 app）回统计页：今日 3/30、累计 6 次、今日柱 3（`g1-focus-refresh.png`）；压力卡今日到期 38→37、新卡 38→36、学习中 0→1（`g1-focus-refresh-pressure.png`），滚动位置保留、无重载闪屏
  - ✅ b 复习历史三段切换：默认日档「近 30 日复习」（10-04=6、10-05=3，与统计页近 7 日一致，列表含逐条记录）；周档「近 30 日 · 按周」W36–W41 六柱（W40=6、W41=3）；月档「近 30 日 · 按月」9月/10月两柱（10月=9）。三档选中态高亮正确，列表数据同源一致（`g2-history-day/week/month.png`）
  - ✅ c 回归：学习页当前模式（专家）四键「认识/简单/模糊/忘记」正常渲染且可点（实际完成 2 次评分，队列与计数正确推进）（`g3-regression-fourkeys.png`）；**三键模式未测**（需切换评分模式开关，属设备状态变更，超出冒烟范围）
  - ✅ c 回归：统计页热力图（近一年格阵 + 图例）与压力卡（7天/30天切换、今日基准线）渲染正常（`g3-regression-stats.png`）
  - ✅ 稳定性：全程无 crash（`logcat -s AndroidRuntime:E` 无 wordfolio 相关记录；验证结束后进程存活 pidof=22080）
- **未做**：iOS 侧验证（ADR-0006 暂停中）；真机（非模拟器）验证未做；三键评分模式回归未测（见上）

## §4 质量事故与修复

| 事故 | 根因 | 修复 | 教训 |
|---|---|---|---|
| 无 fix/revert commit | M-G 区间（`bf8310a..67da8a1`）4 个 commit，无 fix/revert | — | — |
| G1 切片中途 lint 报 JSX 解析错（非入库事故，切片内修复） | 第二次编辑遗留了重复的 `<>` 开标签 | 删除重复标签后复跑 `pnpm lint` / `pnpm typecheck` / `pnpm test` 全绿 | 多次编辑同一文件后先自查标签配对再跑门禁 |
| G2 切片首轮 typecheck 报 TS18047（非入库事故，切片内修复） | `stats-core.ts` 聚合循环内空值窄化失败 | 重构为非空局部变量后通过 | 聚合累加循环避免直接索引可空结构 |

两起均为切片内自查发现、切片内修复，最终入库代码无对应缺陷；无用户可见事故。

## §5 ADR 清单

- ADR-0005 客户端技术栈（Accepted，T0）——G2 前端聚合、G3 竞态防护均在客户端纯函数层落地，不触碰两库分离边界
- ADR-0006 发布策略——Android beta 先行、iOS 暂停（Accepted，2026-09-29）
- M-G 期间无新增 ADR；G2 聚合窗口（近 30 日内做周/月聚合、不扩窗口）、G1 内联报错语义（刷新失败保留已显示数据）、G3 竞态防护机制（写序号 + pending 双闸）等设计决策记录于功能逻辑树与各 commit message

## §6 AI 使用披露

- M-G 区间 4 个 commit（`732668e` 聚焦刷新、`05f211d` 周月聚合、`747a8d0` 复核遗留清偿、`67da8a1` release bump）全部由 AI 代理执行，用户以「签收」把关
- 本报告由 AI 文档收尾切片撰写：§2 门禁数字（lint/typecheck/vitest 全量 137 + 三文件 59）、aapt2 versionName 复核、逐文件用例计数、改动文件清单（`git diff --name-only`）、以及 §7 抽查审计所列代码行核读为该会话实跑实读；各切片范围描述与冒烟 8 场景细节引自对应切片交付说明，其中代码行号引用、截图存在性（`dist/smoke-beta21/` 13 张）、测试计数已由本切片逐一抽查复核（见 §7）

## §7 抽查审计记录

- **G1 聚焦刷新单一触发**：`(tabs)/stats.tsx` 内已无 mount-only 数据拉取 useEffect（`grep` 实核仅剩 hydrate 类 effect），数据拉取唯一入口为 `useFocusEffect(useCallback(...))`（`stats.tsx:84-121`）；`todayKey(new Date())` 在聚焦回调内重算（`stats.tsx:89`）；内联报错与首载错误框分支、`setLoadError(null)` 清除路径实读一致
- **G3-② 竞态防护双闸**：`ratingWriteSeqRef` / `ratingWritePendingRef` 声明与注释（`stats.tsx:75-78`）、聚焦读 readSeq 比对（`stats.tsx:127-141`）、`toggleExpertMode` 序号自增 + finally 条件清 pending（`stats.tsx:144-158`）逐行实读，机制与切片声明一致；`finally` 中 `ratingWriteSeqRef.current === writeSeq` 判断防止早完成的旧写清掉新写的 pending
- **G3-① 常量提取行为等价**：`PRIMARY_GRADE: Grade = Rating.Good`（`rating-core.ts:10`）与学习屏两处比较（`(tabs)/study.tsx:426,431`）实核一致；FSRS Rating.Good = 3，原魔法数字行为零变化
- **G3-④ key 唯一性**：`MorphemeCard.tsx:22` 为 `key={m.morpheme}`；切片对发布物 `assets/db/wordfolio.db` 实测 schema：morpheme 表 `morpheme TEXT NOT NULL UNIQUE`、entry_morpheme 复合主键防同词条重复关联，列表内 morpheme 必唯一
- **G2 纯函数与 UI**：`aggregateTrend`（`stats-core.ts:227`）ISO 周/月分组逻辑实读与声明一致；`history.tsx:105-115` 三段切换 accessibilityRole/state 实核一致；取数仍为 `getReviewHistory(30)`，`git diff bf8310a..67da8a1 -- src/db/study.ts` 为空
- **行号勘误**：G2 切片交付说明称 aggregateTrend 落 `stats-core.ts:246`，实际为 `stats-core.ts:227`（切片间编辑错位所致），本报告按实读行号记账
- **安全 hook 合规**：M-G 零新增 SQL、零新增依赖（改动文件清单无 package.json）、无新增网络请求面
- **网络红线**：G1–G3 均为本地数据消费与纯函数/UI 改造，无新增网络请求面

## §8 下一阶段建议（签收后）

开放债务（承接 M-F 报告 §8 清单，M-E/M-F 文档债已于本轮清偿）：

- **词根词缀数据灌入（最大外部依赖）**：上游 M2-T09 启动后向 morpheme/entry_morpheme 灌数、随发布物下发，F2 区块即自动显现（无需改码）；届时需补一次有数据路径的真机冒烟（M-F 冒烟 c 的补考），并抽查 kind 分布与排序正确性（G3-④ 已实证 morpheme 唯一性，key 无需回退索引后缀）
- **iOS**：ADR-0006 暂停中，恢复时补验评分模式/统计新卡（聚焦刷新、热力图、压力卡）/复习历史周月切换 iOS 侧行为
- **OTA**：EAS Update（channel: beta）预留未启用，作为热修候补通道评估
- **FSRS 参数**：request_retention 0.9 冻结至内测数据回收（逻辑树 §5.4，沿用 M-D 决定）；专家模式四键回收的自评分布数据可作为将来调参输入
- **双商店**：注册 Google Play 开发者账号后走公测轨道；beta.21 APK 已就绪可直发内测群
- **评分模式数据观察**：内测期观察三档/专家模式使用占比，若专家模式占比过低可考虑把四键改为学习页内折叠入口（当前仅统计页可切）；G3-② 竞态修复后「写失败」路径的下次聚焦对齐行为可在内测中观察确认

## 放行签字（G3 适配）

- [ ] 用户验收（Milestone Owner）：＿＿＿＿
- [ ] 安全复核：＿＿＿＿（M-G 区间无新增依赖、无新增 SQL、无新增网络请求面；本报告不据此宣称项目安全状态；最近一次 Mimosa deep 扫描归档 `docs/security/2026-09-29-mimosa-deep-scan.md`）
