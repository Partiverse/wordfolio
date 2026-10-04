# M-C 里程碑报告：练习扩展

日期：2026-10-04 ｜ 状态：**已签收**（2026-10-04，用户链式确认） ｜ 计划来源：移动端开发计划（2026-09-28 批准）

> 报告骨架沿用 partisync-milestone-report 技能（§1–§8）；本仓为 Expo 项目，机器门禁以 pnpm 三件套 + 双端实测替代 cargo 体系。

## §1 范围与结果

计划范围（dev-plan）：义项四选一、听音辨义、拼写听写、例句挖空（依赖 T08/T09 例句数据）、精选包（依赖原型 100 词富字段）。

| 计划项 | 状态 | 交付与证据 |
|---|---|---|
| 义项四选一 | ✅ | `components/QuizCard.tsx`（`variant='meaning'`）+ `study/quiz-core.buildChoice`；干扰项同词性优先、排除同词头与同文项；设备实测答题推进 |
| 听音辨义 | ✅ | `variant='listen'`：藏词头 + 卡片亮出自动播放 + 重播键；实测 `[audio] a <- cache` |
| 拼写听写 | ✅ | `variant='spell'`：输入框 + 提交，答错展示正确答案；`normalizeSpelling`/`isSpellingCorrect` 判分容忍大小写/空格/连字符变体；实测键盘回车提交并判分推进 |
| 例句挖空 | ⏸ 阻塞 | 依赖上游例句数据（M2-T08 未完成，v0.1-m1 例句表为空）。逻辑树槽位表已预留 |
| 精选包（原型 100 词富字段） | ⏸ 阻塞 | 依赖原型数据导出与词库侧承接，未启动 |

**降级说明**：三项题型阻塞项均因上游数据未到，不是实现能力问题；数据到位后按逻辑树槽位表接入即可（同一 QuizCard 骨架 + buildChoice，边际成本低）。

**里程碑外顺带完成（内测反馈驱动，不在原计划内）**：
- 发音源重排为有道 dictvoice 首选（0.13–0.25s 国内直连，替代韦氏 media CDN 的时通时断），beta.12
- 本地 release 构建链路打通（`expo prebuild` + arm64 R8，2–5 分钟/包，不占 EAS 额度），beta.13 起
- 修复一处已提交的崩溃（study.tsx default export 丢失，见 §4）

## §2 验收证据

- **门禁**：lint 0 问题、tsc 干净、**vitest 60/60 通过**（7 文件：bootstrap 3 / 检索 14 / FSRS 12 / 队列打散 4 / 统计 11 / 收藏 5 / 题型 11）
- **题型不变量**（tests/quiz-core.test.ts）：4 选项必含正确项、无重复 stableId/文本、排除同词头、干扰池不足降级、shuffle 保序不变、拼写判分容错变体
- **实机闭环**（模拟器 release 包，非仅单测）：
  - 四选一：出题（a 的 n 义项 + 同词性干扰）→ 答对推进 0→2/20
  - 听音：自动播放成功 → 答题推进 0→1/20
  - 拼写：输入 → 回车提交 → 判分推进 0→1/20
  - 四模式 chips 并排无溢出；release 包 R8 下零崩溃
- **产物**：`dist/wordfolio-0.1.0-beta.15-arm64.apk` 38MB（arm64-only，R8 混淆+资源收缩）
- **规模**：src+tests 37 个源文件 / 4415 行

## §3 测试证据

- CI：github.com/Partiverse/wordfolio 绿（lint+typecheck+vitest，每 commit 必跑）
- 端到端验证矩阵：每题型均经「debug 包（Metro 快迭代）→ release 包（R8 + 独立运行）」两道，install 冒烟 + 交互截图

## §4 质量事故与修复

| 事故 | 根因 | 修复 | 教训 |
|---|---|---|---|
| 练习 tab 渲染崩溃（`missing the required default export`） | python heredoc 批量跨文件补丁把 QuizCard 副本写进 study.tsx；TS 不检查 default export，门禁全绿仍提交 | git 恢复基线 + Edit 逐处重打（`54467fd`） | 跨文件修改用 Edit 不用脚本批写；TS 静态检查有盲区，运行时冒烟不可省 |
| 发音全程静默 | `AbortSignal.timeout` Hermes 未实现 → fetch 抛 TypeError → 双源全灭 → TTS 兜底 | 换 `timeoutGuard`（Promise.race + setTimeout）（`1640fa1`） | RN 非 Web API 需逐个确认引擎支持 |
| 本地构建环境失效 | foojay API 国内不可达 → JDK 17 缺失 | TUNA 镜像手装 `~/.jdks/jdk-17.0.20.1+1`（`54467fd` 同期） | 记录在项目记忆的构建环境段 |

## §5 ADR 清单

- ADR-0005 客户端技术栈（Accepted，T0）
- ADR-0006 发布策略——Android beta 先行、iOS 暂停（Accepted，2026-09-29）
- M-C 期间无新增 ADR；题型设计决策记录于功能逻辑树 §6 槽位表（每题型标注兑现状态）

## §6 AI 使用披露

- M-C 区间 commits 12 个（`6e51e65..5e37093`），全部由 AI 代理执行，用户以「确认发布范围 + 签收」把关
- 4 处测试覆盖缺口已由 Mimosa 工具辅助发现（quiz-core/shuffle 弱随机告警为误报——题目乱序非加密用途，已在代码注释留痕）

## §7 抽查审计记录

- 三题型共用骨架（buildChoice 出题 + answerQuiz 计分 + review_log 留痕），抽查确认计分路径唯一、无旁路写入
- `getDistractorSenses` SQL 已在真实词库 host 验证：排除同词头义项、同词性优先
- 无新增外部依赖（expo-audio/notifications/vector-icons 均为 M-B 期间引入）

## §8 下一阶段建议（M-D 公测前置）

开放债务：
- **上游阻塞**：例句数据（M2-T08）→ 解锁例句挖空 + 例句区；CEFR 标注 → 解锁难度筛选
- 分发：beta 手动发 APK 已有稳定链路；EAS Update OTA 通道已在 beta profile 预留（`channel: beta`），尚未启用
- 提醒：Android 已验证，**iOS 通知链路未验证**（恢复 iOS 分发时需补）
- FSRS 参数冻结：request_retention 0.9 为起步值，需 M-D 内测数据回收后再调（逻辑树 §5.4 冻结说明）

## 放行签字（G3 适配）

- [x] 用户验收（Milestone Owner）：已签收 2026-10-04
- [ ] 安全复核：Mimosa deep 扫描已归档（主仓 0 发现，见 `docs/security/2026-09-29-mimosa-deep-scan.md`）
