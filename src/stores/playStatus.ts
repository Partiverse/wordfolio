// 发音播放状态的轻量反馈：三层降级（有道/合成音/失败）对用户原本完全静默，
// 内测反馈「发音无效」无法定位是哪层失败——这里把每次失败/降级显式浮出。
import { create } from 'zustand';

interface PlayStatusState {
  msg: string | null;
  seq: number; // 递增序号：同文案连续触发也能让 UI 感知变化
  show: (msg: string) => void;
  clear: () => void;
}

export const usePlayStatus = create<PlayStatusState>((set) => ({
  msg: null,
  seq: 0,
  show: (msg) => set((s) => ({ msg, seq: s.seq + 1 })),
  clear: () => set({ msg: null }),
}));
