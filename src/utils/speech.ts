// TTS 点读（expo-speech）。
// 实测坑（beta.2 内测反馈「发音无效」）：`Speech.speak()` 返回 void，出错不抛异常、
// 也没有回调——设备缺 TTS 引擎或对应语言包时完全静默。因此这里做两件事：
// 1) 启动时探测可用语音，缺引擎/语言包时给出可见提示而不是死按钮；
// 2) speak 前先 stop，避免连续点击排队导致的卡顿感。
import * as Speech from 'expo-speech';

export type SpeechLang = 'en-US' | 'zh-CN';

let cached: Promise<Record<SpeechLang, boolean>> | null = null;

/** 探测两种语言是否都有可用语音；失败一律当作不可用（保守，避免又变静默）。 */
export function probeVoices(): Promise<Record<SpeechLang, boolean>> {
  if (!cached) {
    cached = Speech.getAvailableVoicesAsync()
      .then((voices) => ({
        'en-US': voices.some((v) => v.language.startsWith('en')),
        'zh-CN': voices.some((v) => v.language.toLowerCase().startsWith('zh')),
      }))
      .catch(() => ({ 'en-US': false, 'zh-CN': false }));
  }
  return cached;
}

export function speak(text: string, lang: SpeechLang): void {
  if (!text) return;
  // 打断上一条再念，避免多次点击后语音排队滞后
  Speech.stop().catch(() => {});
  Speech.speak(text, { language: lang, rate: lang === 'zh-CN' ? 0.95 : 0.9 });
}

export function speakEn(text: string): void {
  speak(text, 'en-US');
}

export function speakZh(text: string): void {
  speak(text, 'zh-CN');
}
