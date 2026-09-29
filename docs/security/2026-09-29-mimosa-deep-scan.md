# Mimosa 深度安全扫描结论（2026-09-29）

双仓各跑一次 Mimosa deep 扫描（static only，不执行运行时逻辑），结论归档如下。

## wordfolio（移动客户端，本仓）

- scanId：`scan-2026-09-29T04-00-21.966Z-b5f4183da0d3`
- **发现：0**（high 0 / medium 0 / low 0）
- 依赖扫描：36 包完成，0 条命中通告
- 封印：`sha256:f34af9ab46f058036e8f19183b276d511f4bc083ef4d94044d1112bb7664dbd1`
- 报告：`~/.mimosa/security-scans/project-4ecedf9c9c115f8b1ad778d5/<scanId>/`

## wordfolio-lexicon（上游词库工厂，`~/ai-dev-codebase/wordfolio-dev`）

- scanId：`scan-2026-09-29T03-58-22.641Z-2fee82c10a82`
- 发现：2 × LOW（CWE-330 不安全随机数）
  - `pipeline/scripts/m1_package.py:136` — `random.Random(42)`
  - `scripts/build_alignment_set.py:94` — `random.Random(SEED)`
  - **研判：均为误报，接受不改**。两处都是固定种子的可复现抽检/抽样（抽检包、对齐集），不涉及令牌、鉴权等安全敏感随机性；改为 CSPRNG 反而破坏可复现性。
- 依赖扫描：116 包完成，**1 条通告命中但工具未回传包名**——待定位（可用 pip-audit 复核 `pyproject.toml`/`uv.lock`）。
- 封印：`sha256:2bd841e08f3b46fd275eb90719dd6094a97340c27fe0d31e384ad3992e11031b`

## 备注

- 本次为对 T0/M-A 期间多次 commit hook 提示「scanner_enobufs 未获完整扫描」的补课；后续大改动后建议复扫。
- 扫描覆盖存在常规缺口（调用图动态派发部分不完整），见 coverage.json `gaps`。
