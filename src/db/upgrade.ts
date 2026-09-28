// 发布物 bootstrap 升级决策（纯函数，无 RN 依赖，供单元测试）。
// 规则（ADR-0005 D3）：沙箱无库则拷贝；沙箱 edition 落后于打包 edition 则删库重拷；
// 一致则复用。词库发布物无用户状态，重拷安全。

export type BootstrapAction = 'copy' | 'recopy' | 'reuse';

export function resolveBootstrapAction(
  sandboxEdition: string | null,
  bundledEdition: string,
): BootstrapAction {
  if (sandboxEdition === null) return 'copy';
  if (sandboxEdition !== bundledEdition) return 'recopy';
  return 'reuse';
}
