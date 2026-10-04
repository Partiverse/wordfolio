# M-E 里程碑报告：学习数据自主与个性化

日期：2026-10-04 ｜ 状态：**待签收** ｜ 计划来源：移动端开发计划（2026-09-28 批准，HANDOFF §4）

> 报告骨架沿用 M-D 报告（§1–§8，源出 partisync-milestone-report 技能）；本仓为 Expo 项目，机器门禁以 pnpm 三件套 + 实机冒烟替代 cargo 体系。

## §1 范围与结果

M-E 区间（`70d92ed..6879535`）6 个 commit、23 文件 +1261/−49（含 release commit 仅 app.json 1 行）。逐切片范围与证据：

| 计划项 | 状态 | 交付与证据 | issues |
|---|---|---|---|
| E1 学习数据导出/导入 | ✅ | `1b19f7f`（5 文件 +585/−1）。`exportLearningData`（`src/db/study.ts:445`）将 learning.db 五表（favorite / review_card / review_log / daily_goal / settings）全量导出 JSON；`importLearningData`（`src/db/study.ts:490`）按「跳过已存在主键」合并导入（review_log 无业务主键，全量追加不查重，`src/db/study.ts:489` 注释）；归并/解析纯函数抽 `src/study/merge-core.ts`（13 例 vitest）。关于页新增「导出学习数据 / 从备份导入」操作项（`src/app/about.tsx:129-146`），走 expo-file-system/legacy 读写 `documentDirectory/wordfolio-backup.json`，playStatus toast 反馈 | 无。切片实测三道门禁全绿；commit 时出现 Mimosa `scanner_enobufs` 兼容提示，按既定说明继续（未宣称项目安全） |
| E2 复习历史页 | ✅ | `c9c95a1`。`getRecentReviews`（`src/db/study.ts:303`）；新建 `/history` 屏（`src/app/history.tsx`）：近 30 日 `bucketHistory` 柱状 + 逐次明细（评分中文标签、本地时区 MM-DD HH:mm、练习记录带「练习」标记、指定空态文案）；注册路由，统计页「其他」卡入口（`(tabs)/stats.tsx:252-254`）；逻辑树导航树与 §6 槽位同步更新；stats-core 顺带 +3 例（bucketHistory 聚合） | 无 |
| E3 练习统计与模式记忆 | ✅ | `7bf6bd5`。`getPracticeDaily`（`src/db/study.ts:340`）按日聚合练习记录；统计页「近 7 日自由练习」柱状卡（`(tabs)/stats.tsx:162`，共用 WeekBars、琥珀 accentWarning `#d97706`/`#fbbf24`，与复习曲线 accentSuccess 绿区分）；学习模式 settings 记忆（聚焦恢复 + 切模式写入，`src/study/mode-core.ts` 纯函数 3 例） | 无 |
| E4 手动主题切换 | ✅ | `046dddb`。主题偏好 store（`src/stores/theme.ts`，落既有 settings 表 key=`'theme'`，表定义 `src/db/study.ts:63`）；统计页「外观」三选 chips（浅色/深色/跟随系统，`(tabs)/stats.tsx:232-235`）；`useTheme` 按偏好覆盖、缺省回落系统色，三态即时生效（`src/theme/theme-core.ts` 纯函数 5 例） | 无 |
| E5 上游接入骨架 | ✅（骨架，等 v0.2 数据） | `010882a`（6 文件 +136/−8）。repository 探测函数 `hasCefrData`（`src/db/repository.ts:316`）/ `hasExampleData`（`src/db/repository.ts:324`）；判定纯函数 `src/study/upstream-core.ts`（4 例 vitest，头注明示无 RN/SQLite 依赖）；词库屏 CEFR chips 显隐接线（`(tabs)/index.tsx:25,64`）、学习屏例句挖空判定位（`(tabs)/study.tsx:26,31,78`）；逻辑树 §6 标注「代码就绪，等 v0.2 数据」。v0.1-m1 无标注数据，chips/入口自动隐藏——数据到位后无需改码即显现 | 无 |
| V1 beta.18 构建与冒烟 | ✅ | `6879535`（release：app.json version → `0.1.0-beta.18`，`app.json:5` 本切片复核）。dist APK `wordfolio-0.1.0-beta.18-arm64.apk` 40,315,859 B（2026-10-04 21:19）；emulator-5554 在线，安装冒烟 5 场景通过：①词库 tab（499 词·v0.1-m1，筛选 chips 正常，CEFR chips 无数据自动隐藏）②词条详情「in」（5 义项卡 + 中英定义 + 行级点读，无例句区按设计隐藏）③学习卡片模式（翻卡 → 四键评分「一般」→ 今日 2/30 变 3/30，评分落库，下一卡出现）④统计 tab（今日已复习 3/30 与评分一致，柱状图/卡片分布/外观切换正常渲染）⑤关于页（版本 0.1.0-beta.18、词库 v0.1-m1 生成信息正常）。logcat 无 FATAL EXCEPTION；截图 6 张 `screenshots/beta18-smoke-01~06-*.png` | 无 |

**范围说明**：E5 是「接入骨架」不是功能实装——显隐由数据探测驱动，上游 v0.1-m1 无 CEFR/例句数据时对用户完全不可见，属设计行为而非缺陷。beta.18 APK 构建于 release commit（21:24）前 5 分钟，bump 值当时已在工作区（冒烟关于页显示 0.1.0-beta.18 佐证），包内容即 beta.18 全量 M-E 改动——与 M-D 时「包落后于 commits」情形不同，本次发布物已含全部 M-E 代码。

## §2 验收证据

- **门禁**（2026-10-04 21:25 本报告撰写会话实跑）：`pnpm lint` 0 问题（exit 0，expo lint）、`pnpm typecheck` 干净（exit 0，tsc --noEmit）、**vitest 97/97 通过（11 文件，394ms，exit 0）**：upgrade 3 / search 14 / merge-core 13 / queue 8 / fsrs-core 12 / stats-core 19 / learning-core 5 / quiz-core 11 / theme-core 5 / mode-core 3 / upstream-core 4
- **用例账目**（M-D 69 → M-E 97，+28，逐 commit 可溯）：E1 merge-core 13（`1b19f7f`）→ E2 stats-core +3（`c9c95a1`）→ E3 mode-core 3（`7bf6bd5`）→ E4 theme-core 5（`046dddb`）→ E5 upstream-core 4（`010882a`）。E1 切片当时口径「8 文件 82 例」为该 commit 时点实况，后续三切片继续增补至当前 11 文件 97 例
- **代码闭环**：四个新纯函数模块全部落 `src/study/`、`src/theme/` 且无 RN/SQLite 依赖（`src/study/upstream-core.ts:2` 头注明示），符合「纯逻辑拆纯函数 + vitest」仓库规约；数据层改动集中在 `src/db/study.ts`（导出/导入 +144 行、getRecentReviews/getPracticeDaily/settings 读写）
- **产物**：`dist/wordfolio-0.1.0-beta.18-arm64.apk`（40,315,859 B，2026-10-04 21:19），已含全部 M-E 改动；beta.17 及更早包不含 M-E
- **规模**：src+tests 50 个源文件 / 6015 行（M-D 时 40 文件 / 4807 行）
- **逻辑树核对**（本切片执行）：导航树含 `history`（复习历史，§1 第 16 行）与 `about`（关于，§1 第 17 行）压栈页节点，入口均挂统计 tab「其他」卡（§1 第 24–25 行）；§6 槽位表「复习历史完整曲线」已标**已交付**（§6 第 151 行）、「CEFR 筛选」「例句挖空」两行标「代码就绪，等 v0.2 数据」（§6 第 157–158 行）——与代码实况一致，确认无误

## §3 测试证据

- 本地三道门禁为数字出处（本会话实跑命令：`pnpm lint`、`pnpm typecheck`、`pnpm test`；vitest v5.0.2，Test Files 11 passed (11)、Tests 97 passed (97)，394ms，三命令 exit 均 0）
- CI：M-E 区间 6 个 commit 均未 push（`git rev-list --count origin/main..HEAD` = 6），远端 CI 未及验证；push 后以 CI 为准
- 实机验证：V1 切片在 emulator-5554 完成 5 场景冒烟（细节见 §1 V1 行，切片记录）；本报告切片核对冒烟截图 6 张存在（`screenshots/beta18-smoke-01~06-*.png`，2026-10-04 21:20–21:23）与 `app.json:5` 版本号一致，未重跑冒烟——真机表现待签收时确认

## §4 质量事故与修复

| 事故 | 根因 | 修复 | 教训 |
|---|---|---|---|
| 无 | M-E 区间（`70d92ed..6879535`）6 个 commit，无 fix/revert | — | — |

## §5 ADR 清单

- ADR-0005 客户端技术栈（Accepted，T0）——learning.db 设备端可写、发布物只读的两库分离是 E1 导出/导入范围的直接依据
- ADR-0006 发布策略——Android beta 先行、iOS 暂停（Accepted，2026-09-29）
- M-E 期间无新增 ADR；E1 备份文件格式、E4 主题三态语义等设计决策记录于各 commit message 与功能逻辑树（E2 `c9c95a1`、E5 `010882a` 两 commit 含逻辑树同步更新；E1/E3/E4 未同步逻辑树，欠账见 §8）

## §6 AI 使用披露

- M-E 区间 6 个 commit（`1b19f7f` 导出导入、`c9c95a1` 复习历史页、`7bf6bd5` 练习统计与模式记忆、`046dddb` 手动主题切换、`010882a` 上游接入骨架、`6879535` release bump）全部由 AI 代理执行，用户以「签收」把关
- 本报告由 AI 文档收尾切片撰写：§2 门禁数字与逻辑树核对为该会话实跑实读；各切片范围描述（如 E1 的「5 files changed, 585 insertions」、V1 冒烟五场景细节）引自对应切片交付说明，其中 commit 统计、文件行号引用、截图与版本号已由本切片逐一抽查复核（见 §7）

## §7 抽查审计记录

- **导出/导入语义**：`exportLearningData` 五表全量（settings 按 key 排序，`src/db/study.ts:461`）；`importLearningData` 跳过已存在主键（favorite=entry_id / review_card=stable_id / daily_goal=day / settings=key），review_log 无业务主键全量追加（`src/db/study.ts:489` 注释与实现一致）；归并纯函数在 `src/study/merge-core.ts`，13 例 vitest 覆盖——抽查确认与「JSON 备份往返、跳过已存在键」commit 声明一致
- **纯函数规约**：merge-core / mode-core / upstream-core 落 `src/study/`、theme-core 落 `src/theme/`，均无 RN/SQLite 依赖，各有对应 vitest 文件；符合仓库规约
- **主题实现**：偏好落**既有** settings 表 key=`'theme'`（`src/stores/theme.ts:8`，表定义 `src/db/study.ts:63`），未新开表；统计页三选 chips 即时切换（`(tabs)/stats.tsx:232-235`）
- **E5 数据驱动显隐**：无写死特性开关，全部经 `hasCefrData`/`hasExampleData` 探测（`src/db/repository.ts:316,324`）→ 词库屏（`index.tsx:64`）/ 学习屏（`study.tsx:78`）判定；v0.1-m1 无数据自动隐藏，与 V1 冒烟①「CEFR chips 自动隐藏」观察互证
- **色彩语义**：练习柱状用 accentWarning（`#d97706`/`#fbbf24` 琥珀，`src/theme/tokens.ts:43,82`）、复习曲线用 accentSuccess（绿）——与逻辑树 §8「琥珀=主行动/选中、绿=完成」语义一致
- **依赖与生成物**：M-E 区间 `package.json` 零改动（expo-file-system 为 Expo 内置模块，无新增外部依赖）；`git diff --name-only` 确认未触碰 android/、ios/ CNG 生成物
- **网络红线**：E1 导出/导入走 expo-file-system 本地文件，M-E 无新增网络请求面，符合「仅 http/https + host 校验」约束（本切片预期无网络请求，实际亦无）
- **逻辑树核对**：§6 槽位表与 §1 导航树与实况一致（history/about 已在导航树，§6 两处已交付/两处标「代码就绪等 v0.2」）；逻辑树其余章节滞后项列入 §8 文档债，本切片（只写报告）未改动逻辑树

## §8 下一阶段建议（签收后）

开放债务：

- **上游 v0.2 数据**：CEFR 标注、例句（M2-T08）、词书 exam_tag 到位后，E5 骨架转实装、词书选择解锁——`hasCefrData`/`hasExampleData` 返 true 即自动显现，无需改码；这是 M-E 遗留的最大外部依赖
- **iOS**：ADR-0006 暂停中，恢复需按其触发条件执行，届时补验主题/提醒/发音链 iOS 侧行为
- **OTA**：EAS Update（channel: beta）预留未启用，作为热修/词库小更新候补通道评估
- **逻辑树文档债**：头部「对应版本：beta.15」未随 beta.18 更新；§3.1 表结构未列 settings 表（E1/E3/E4 已在用）；§7 组件清单缺 merge-core / mode-core / theme-core / upstream-core 四模块；复习历史「按周/月维度切换」未做（§6 已注明）——建议下个文档切片一次补齐
- **导入合并语义**：当前「跳过已存在主键 + review_log 全量追加」适合备份恢复/重装场景；跨设备合并（同 key 冲突取新、review_log 去重）无策略选项，多机用户出现前不必做
- FSRS 参数：request_retention 0.9 冻结至内测数据回收（逻辑树 §5.4，沿用 M-D 决定）
- **双商店**：注册 Google Play 开发者账号后走公测轨道；beta.18 APK 已就绪可直发内测群

## 放行签字（G3 适配）

- [ ] 用户验收（Milestone Owner）：＿＿＿＿
- [ ] 安全复核：＿＿＿＿（最近一次 Mimosa deep 扫描归档 `docs/security/2026-09-29-mimosa-deep-scan.md`，主仓 0 发现；M-E 区间无新增依赖，未重扫。E1 commit 时出现的 Mimosa `scanner_enobufs` 为扫描器缓冲区分配的兼容提示，非扫描结论，本报告不据此宣称项目安全状态）
