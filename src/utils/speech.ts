// TTS 点读（Spike S2 已验证 expo-speech onDone 无 crash）。
import * as Speech from 'expo-speech';

export function speakEn(text: string): void {
  Speech.speak(text, { language: 'en-US', rate: 0.9 });
}

export function speakZh(text: string): void {
  Speech.speak(text, { language: 'zh-CN', rate: 0.95 });
}
