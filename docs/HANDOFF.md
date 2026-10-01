# Wordfolio 移动客户端 — 交接文档（面向 AI 编码代理）

> 本文档供新接手的 AI 编码代理（MiniMax Code 或其他）一次性获取项目全貌。根目录 `AGENTS.md` 是常驻规则（Expo/RN 硬约束 + 工程命令），本文是状态、路线与历史坑的快照。**两者冲突时以 `AGENTS.md` 和 `docs/adr/` 为准。**
>
> 快照日期：2026-10-01。若 git log 中已有更新的里程碑报告（`docs/reports/`），以报告为准。

## 1. 项目是什么

wordfolio 是面向中国学习者的**义项级**英语词汇学习 App：一个单词的多个义项（sense）各自独立建卡、独立复习。本地优先零后端（ADR-0004），无账号、无服务器，全部数据在设备端。

双仓架构：

| 仓库 | 角色 | 地址 |
|---|---|---|
| 本仓 `wordfolio` | 移动客户端（Expo/RN），消费发布物 | `github.com/Partiverse/wordfolio`（private） |
| 上游 `wordfolio-dev` | 词库内容工厂（Python 管线），生产 SQLite 发布物 | `github.com/Partiverse/wordfolio-lexicon`（private，本地目录仍叫 `~/ai-dev-codebase/wordfolio-dev`） |

本仓决策记录在 `docs/adr/`，编号从 0005 起延续上游 ADR-0001~0010；治理账本在上游仓。

## 2. 架构与数据流（ADR-0005，Accepted）

- 发布物 `assets/db/wordfolio.db` 从上游 `data/releases/<edition>/` 拷入，**只读**，含 FTS5 全文索引。换发布物 = 覆盖该文件 + 更新 `src/db/release.ts` 的 `BUNDLED_EDITION`；首启时按 `meta.edition` 自动重拷升级（`src/db/upgrade.ts`）。
- 用户学习状态存独立的设备端 `learning.db`（`src/db/learning.ts` 建库、`src/db/study.ts` 扩展了 `review_card` FSRS 状态表 + `daily_goal` 表）。**用户库与发布物分离，升级发布物不丢学习数据。**
- 学习引擎：ts-fsrs（设备端）。**v5 API 注意**：`fsrs()` 单参数，字段是 `request_retention`（不是 v4 的双参数 / `desired_retention`）。
- 检索：FTS5 `sense_fts` + 中文 CJK LIKE 回退（`src/db/search.ts` 纯函数 + `src/db/repository.ts` 的 `searchSenses`）。unicode61 分词器中文单字/子串命中 0 行是已知缺口，10 万词级再评估 trigram（挂上游 M2-T08）。
- 技术栈：Expo SDK 57 / RN 0.86 / React 19 / TypeScript / expo-router / expo-sqlite / expo-speech / nativewind + react-native-reusables / zustand / ts-fsrs。包管理 pnpm。
- 设计系统：早期原型（Amber/Taupe 暖色 token、禅意闪卡）迁移而来，token 在 `src/theme/tokens.ts`（light/dark 双套）。

## 3. 当前状态（截至 2026-10-01）

| 阶段 | 状态 | 证据 |
|---|---|---|
| T0 脚手架 + spike | ✅ 关闭 | `docs/spikes/T0-spike-结论.md`；双端实测通过 |
| M-A 词库浏览 MVP | ✅ 关闭（待用户签收） | `docs/reports/M-A-report.md`；浏览网格/FTS 搜索/详情/收藏/TTS/暗色全量交付 |
| M-B 学习闭环 | 🔄 进行中（第一片已交付） | ts-fsrs 复习队列上线（commit `49311bc`）：`src/study/fsrs-core.ts` + `src/study/queue.ts`（33 个 vitest 用例）、`src/app/study.tsx` 今日队列/翻卡/四键评分/TTS |
| M-C 练习扩展 | ⏳ 未开始 | — |
| M-D 公测 | ⏳ 未开始 | — |

发布现状：**0.1.0-beta.2** 已发布（首个含学习队列的 beta 包，arm64-only APK ~43MB），内测指引 `docs/beta/beta-0.1.0-internal-test.md`。**ADR-0006（Accepted）：Android beta 先行，iOS 暂停**——iOS 代码与本地构建继续维护，不注册 Apple Developer Program、不对外分发；恢复 iOS 的触发条件与执行清单见 ADR-0006。

## 4. 开发路线（已批准计划，2026-09-28）

**M-B 剩余（学习闭环收尾）**：
1. 每日目标：`daily_goal` 表已建，缺目标设置 UI 与达成判定。
2. 学习统计：复习量/正确率/预测负载展示。
3. 推送提醒：expo-notifications 每日固定时段提醒（需 spike，含 Android 13+ 通知权限）。
4. 闪卡视觉打磨：早期原型的禅意闪卡（3D 翻转、快捷键）向 `src/app/study.tsx` 移植。
5. beta.3 发布 + M-B 里程碑报告（模式参考 `docs/reports/M-A-report.md`）。

**M-C 练习扩展（~2 周）**：义项四选一、听音辨义、拼写听写；例句挖空依赖上游 M2-T08 例句数据；「精选包」——早期原型 100 词 × 22 字段富数据（词根、双语例句、习语、搭配、同义反义链接）弥补管线例句/搭配表空缺。

**M-D 公测（~2 周）**：词书选择（exam_tag 筛选）、edition 更新机制（下载新发布物替换）、连续打卡、Android beta → 公测轨道。

**并行内容线（上游仓，不在本仓做）**：M2 剩余 ~6,500 词生成、Judge 方向一致率 75.5%→80%（闸门 ADR-0010）、T08/T09 例句搭配层、edition v0.9。

**v1.x 差异化路线**：产出型训练（AI 造句批改）、上下文导入抽词、透明定价。

## 5. 工程约定与验证门

- 收尾前必跑：`pnpm lint && pnpm typecheck && pnpm test`（vitest，当前 33 用例）。纯逻辑一律拆成纯函数 + vitest 覆盖（`src/db/search.ts`、`src/study/fsrs-core.ts` 是范本）。
- 依赖一律 `pnpm exec expo install`（解析 SDK 兼容版本）；纯 TS 依赖可 `pnpm add`。pnpm 12 构建审批在 `pnpm-workspace.yaml` 的 `allowBuilds:`，expo install 中途失败重跑 `pnpm install` 即可。
- `ios/`、`android/` 目录是 CNG 生成物，**永不手改**；原生行为配置进 `app.json` / config plugins。
- 新增路由后 typecheck 报错：先跑一次 `pnpm expo start` 重新生成 `.expo/types/router.d.ts`。
- eslint react-hooks 新规则禁 effect 内同步 setState → 用派生状态模式（`data === null` 即 loading），`src/app/` 现有代码是范本。
- 里程碑节奏：每片工作 = 实现 + 测试 + 双端实测 + commit（中文 conventional 前缀）+ 必要时发 beta；里程碑收尾写 `docs/reports/<M-x>-report.md`（含降级说明）。

## 6. 已知坑清单（历史实测，勿重踩）

1. **iOS 27 UIScene**（SDK 58 前一直适用）：Xcode 27 构建的 app 未启用 UIScene lifecycle 则启动即 EXC_BREAKPOINT。解法：`expo-build-properties` 加 `ios.enableSceneSupport: true` + `expo prebuild --clean`（本仓已配置）。SDK 58 起默认启用可移除。官方依据 expo/fyi `ios-scene-lifecycle.md`。
2. **v0.1-m1 无标注数据**：entry.cefr/band/collins_star 全 NULL，exam_tag/example 表全空 → CEFR 筛选 UI 暂缓（repository 参数已保留），例句区条件渲染。等上游 v0.2 数据。
3. **FlatList numColumns**：两个 FlatList 处同一树位置切换列数会触发 Invariant → 各加不同 `key`。
4. **macOS 本地构建环境**：Android 用 `~/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/jdk-17.0.17+10` 的 JDK 17，构建前 unset 代理；iOS 一律 `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`。`expo run:ios` 本地 dev client 是正解（Expo Go 路线已放弃；pod 首轮 ~25min 后有缓存）。
5. **EAS 与凭据纪律**：EAS 项目 `@partiverses-team/wordfolio`（Free 档：15 Android 构建/月，用尽即停）。`eas init` 的 owner 参数是 `--account`；EXPO_TOKEN 只经环境变量传入，不入库、不进 eas.json/CI。beta 发布 = `eas.json` 的 `beta` profile（internal APK + `beta` channel，`gradleCommand` 限定 arm64-v8a——注意 `buildArchs` 字段当前 schema 不允许）。
6. **发版号规范**（ADR-0006）：`0.<minor>.0-beta.<n>`，改 `app.json` version。
7. UI 自动化：idb 未装、AppleScript 未授权 → 双端实测用「临时探针代码 + Metro 热更 + 截图」手法，探针用完必须删。

## 7. 文档索引

- `AGENTS.md`（根）— 常驻硬规则，MiniMax Code 会自动读取
- `docs/adr/ADR-0005-客户端技术栈.md` — 架构基线
- `docs/adr/ADR-0006-发布策略-Android-beta先行.md` — 发布策略与 iOS 恢复条件
- `docs/reports/M-A-report.md` — 里程碑报告范式 + 两项降级说明
- `docs/beta/beta-0.1.0-internal-test.md` — 内测指引（内测用户视角）
- `docs/spikes/T0-spike-结论.md` — FTS5/TTS/DB 打包 spike 结论
- `docs/security/2026-09-29-mimosa-deep-scan.md` — 安全扫描归档（0 发现）
- 上游治理与 ADR-0001~0010：`github.com/Partiverse/wordfolio-lexicon`
