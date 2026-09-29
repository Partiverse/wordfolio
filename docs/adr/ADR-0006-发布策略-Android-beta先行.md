# ADR-0006：发布策略——Android beta 先行，iOS 暂停

- 状态：Accepted
- 日期：2026-09-29
- 决策人：项目所有者（评审拍板）
- 关联：ADR-0005（客户端技术栈）、M-A 里程碑报告

## 背景

ADR-0005 D4 定的平台交付策略是「双端同步」：自 M-A 起每里程碑同步出 iOS TestFlight 与 Android 内部轨道包。M-A 收尾时，EAS 账号 `partiverses-team`（Free 档）已跑通 Android 云构建，但 iOS 侧的 TestFlight 交付需要额外的 **Apple Developer Program 会员（$99/年）** 与 EAS iOS 凭据配置。

内测阶段的实际目标是：让 5–10 名目标用户（考研/四六级人群）尽快用上可背单词的客户端，收集学习闭环体感反馈，为 M-B/M-C 迭代提供真实输入。

## 决策

**发布范围收敛为 Android beta 先行，iOS 侧暂停，直至重新评审。**

具体含义：

1. **beta 版本号规范**：`0.<minor>.0-beta.<n>`（当前 `0.1.0-beta.1`）。beta 期间语义化版本承载功能演进，beta 递增计数承载迭代批次。
2. **构建 profile**：`eas.json` 新增 `beta` profile——`distribution: internal`（直接可安装 APK）、`channel: "beta"`（为后续 OTA 更新预留）、`buildType: apk`（免 AAB 打包，直接分发）。
3. **iOS 暂停项**：不注册 Apple Developer Program，不出 TestFlight 包。iOS 代码路径（expo-router 路由、expo-sqlite、expo-speech、expo-sqlite 学习库）保持双端可编译维护——**iOS 开发与验证继续，只是不对外分发**。任何 iOS 专属 native 依赖仍需保持 iOS 构建可用，避免后续恢复分发时返工。
4. **重评审触发条件**：满足以下任一条件时重新评估 iOS 分发——① 内测用户明确表达 iOS 需求且 Android 样本已满足统计量；② 需要 App Store 品牌背书或搜索流量；③ 有其它收入来源覆盖 $99/年成本。
5. **不做的事**：不将 EXPO_TOKEN 写入 CI secrets 或任何仓库文件——EAS 构建由开发者本地发起，token 仅经环境变量传入。

## 理由

- **成本-收益**：$99/年换 iOS 分发，在单人 + AI 协作、验证学习闭环假设的阶段，Android beta 已能提供全部关键反馈信号。
- **不锁死技术路径**：iOS 构建能力持续维护（CI 不含 iOS 构建，但 `expo run:ios` 本地可验证，本会话已多次实测通过），恢复分发时无需改造。
- **EAS 免费档够用**：15 Android + 15 iOS 构建/月 + 60min CI/CD，beta 迭代节奏（月 2–4 个包）远在额度内，且免费档无超额扣费。

## 后果

- **正面**：分发链路单一（Android APK 直装），内测启动成本近零；发布节奏不受 Apple 审核与年费约束。
- **负面**：iOS 用户无法参与内测，样本偏向 Android 人群（对"手机背单词"场景无系统性偏差，但需在结论中注明）；TestFlight 的免安装更新能力暂不可用，beta 包需手动分发。
- **风险**：若 M-D 公测时决定上 App Store，$99 年费与审核周期（约 1–2 周）将成为关键路径上的新增阻塞项。缓解：M-B/M-C 期间保持 iOS 构建绿，随时可启动注册流程。
- **OTA 通道**：`beta` profile 已绑定 `channel: beta`，为后续 `eas update` 预留；但 EAS Update 免费档 1K MAU，beta 规模内无压力。

## 关联

- 恢复 iOS 分发时的执行清单：注册 Apple Developer → `eas credentials` 配置 App Store Connect API Key → 新增 `ios-beta` profile → 更新本 ADR 状态为 Superseded。
