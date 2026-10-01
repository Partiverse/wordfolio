# Wordfolio 移动客户端

本地优先的词汇学习 App（Expo / React Native / TypeScript）。消费上游词库工厂 [wordfolio-dev](https://github.com/Partiverse/wordfolio-dev) 生产的 SQLite 发布物（含 FTS5 全文索引），不建后端、无需账号即可学习。

治理与决策：

- **新会话/新代理交接：`docs/HANDOFF.md`**（项目全貌、当前状态、开发路线、已知坑，2026-10-01 快照）
- 架构决策：`docs/adr/ADR-0005-客户端技术栈.md`（编号延续上游 ADR-0001~0010）
- T0 spike 结论：`docs/spikes/T0-spike-结论.md`
- 开发计划（已批准，2026-09-28）：T0 脚手架 → M-A 词库浏览 MVP → M-B 学习闭环（ts-fsrs）→ M-C 练习扩展 → M-D 公测

## 开发

```bash
pnpm install
pnpm start            # Expo dev server
pnpm lint && pnpm typecheck && pnpm test   # 提交前必跑
```

- 发布物更新：覆盖 `assets/db/wordfolio.db`，同步更新 `src/db/release.ts` 中 `BUNDLED_EDITION`（首启时按 `meta.edition` 自动重拷升级，见 `src/db/upgrade.ts`）。
- CI：GitHub Actions（lint + typecheck + vitest）；EAS Build 配置见 `eas.json`，启用需在仓库 secrets 配置 `EXPO_TOKEN`。
