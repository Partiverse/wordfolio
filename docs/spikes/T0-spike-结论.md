# T0 Spike 结论（2026-09-28）

> 三个 T0 spike 的实证结论。验证环境：本机模拟器（Android emulator API 35 arm64 已跑通；iOS 模拟器见 §4）。
> 代码位置：`src/db/release.ts`（S1/S3）、`src/app/index.tsx`（Spike 验证屏）、`src/db/upgrade.ts`（S3 纯函数 + 单测）。

## S1：expo-sqlite 读发布物 DB + FTS5 ✅（Android 已验证）

| 项 | 结论 |
|---|---|
| 打包 | `assets/db/wordfolio.db`（1.2MB）经 metro `assetExts.push('db')` + expo-asset 打包，真机沙箱可读 |
| 打开 | `SQLite.openDatabaseAsync` 正常；`meta` 表 edition=v0.1-m1、499 词/2495 义项读取正确 |
| FTS5 | Android 侧 `sqlite_compileoption_used('ENABLE_FTS5')=1`，`sense_fts MATCH` + `bm25()` 排序正常（实测 "run" → run/running 等，bm25 相关性排序正确） |
| **⚠️ 中文检索缺口** | `sense_fts` 建表时**未指定 tokenizer**（默认 unicode61），连续 CJK 串被当作单一 token：整段短语（如 `"跑步比赛"`）可精确命中，`zh_gloss_words` 里空格/标点分隔的多字词（如 `"走近"`）可命中，**但单字/子串查询（如 `"走"`）返回 0 行** |

**对 M-A 的要求（决策输入）**：中文搜索需在 M-A 内修复，二选一（推荐 ①）：
1. **CJK 查询走 LIKE 回退**：检测到含 CJK 时对 `label_zh/definition_zh` 用 `LIKE '%q%'`（v0.1 仅 2495 义项，全表扫描毫秒级；10 万词级再换 trigram）；
2. 上游发布物重建 FTS 为 `tokenize='trigram'`（SQLite ≥3.34，需确认 expo-sqlite 打包的 SQLite 编译进 trigram；顺带挂 M2-T08 发布流程）。

## S2：expo-speech 中英 TTS ✅（Android 已验证）

- `Speech.speak(text, { language: 'en-US' | 'zh-CN' })` 调用无错误、无 crash（logcat 无 FATAL）。
- Android 模拟器自带 TTS 引擎可发声；真机效果待 M-A 内部包再确认。
- 中文 rate 需降至 ~0.95（已实现），长句分段暂停逻辑挂 M-A。

## S3：DB 打包 + edition 版本升级路径 ✅（代码 + 单测 + Android 实测）

- `src/db/upgrade.ts`：`resolveBootstrapAction(sandboxEdition, bundledEdition)` → copy / recopy / reuse，vitest 3 用例全绿。
- 运行期流程：expo-asset 加载 → 读沙箱 DB `meta.edition` → 不一致则删库重拷 → 只读打开。Android 实测首次启动 copy 路径工作正常。
- `BUNDLED_EDITION` 常量目前手工维护在 `src/db/release.ts`（与 `assets/db/wordfolio.db` 同步改）；后续可由发布脚本注入。
- 用户学习状态将存独立 `learning.db`（M-B 创建），发布物升级不影响用户数据。

## 4. iOS 模拟器验证 ✅（2026-09-29 00:49 补验通过，commit e628ba3）

- 环境事实：Xcode 27.0 未被 `xcode-select` 选中（simctl 需 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`）；Xcode 27 已移除 Simulator.app（DeviceHub 替代）；iOS 27 SDK 要求 scene-based life cycle，Expo SDK 57 需在 app.json 开 `ios.enableSceneSupport`（经 expo-build-properties，见 e628ba3）。
- iOS 侧以本地 dev client 构建（`ios/` prebuild + CocoaPods）验证，iPhone 17 模拟器（iOS 27.0）实测：bootstrap v0.1-m1 499/2495、FTS5 YES、bm25 搜索 OK、expo-speech TTS onDone——与 Android 结果一致，spike 全部收口。
- CJK LIKE 回退缺口在 iOS 同样确认，维持 M-A 内解决的既定决策。
- pnpm 12 下 expo-build-packages 依赖链需批准 unrs-resolver 构建脚本（已随 e628ba3 配置）。

## 5. 环境坑备忘（复现构建时看）

- `sdkmanager` 需 `--no_https`（dl.google.com 直连快，走代理反而失败）；国内镜像：Gradle wrapper 走腾讯镜像（已改 `android/gradle/wrapper/gradle-wrapper.properties`），Maven 走阿里镜像（`~/.gradle/init.gradle`）。
- avdmanager 在本机会生成损坏 config（`image.sysdir.1` 多 `sdk/` 前缀、`avd.name=<build>`），需手工修正。
- Gradle 构建需 JDK 17（`~/.gradle/jdks/.../jdk-17.0.17+10/Contents/Home`），系统默认 JDK 25 不兼容。
- `android/` 目录为 prebuild 产物（CNG）；wrapper 镜像修改属本机行为，不应提交（已入 .gitignore 的候选，见 AGENTS.md 说明）。
