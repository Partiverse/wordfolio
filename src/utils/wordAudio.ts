// 真人发音播放：resolveAudioUrl（韦氏→免费词典链，见 ./pronunciation.ts）→ expo-audio 播放，
// 失败回退 TTS（原 expo-speech 路径）。播放器单例复用，避免频繁建实例。
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { resolveAudioUrl, type AudioSource } from './pronunciation';
import { speakEn } from './speech';

let modeReady = false;

async function ensureMode(): Promise<void> {
  if (!modeReady) {
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    modeReady = true;
  }
}

export type PlayResult = 'audio' | 'tts' | 'failed';

/** 播放词头发音：优先真人语音，网络/播放失败回退 TTS。返回实际来源供埋点与调试。 */
export async function playWordAudio(word: string): Promise<PlayResult> {
  const resolved = await resolveAudioUrl(word).catch(() => null);
  if (resolved) {
    try {
      await ensureMode();
      const player = createAudioPlayer(resolved.url);
      player.play();
      return 'audio';
    } catch {
      // 落 TTS
    }
  }
  try {
    speakEn(word);
    return 'tts';
  } catch {
    return 'failed';
  }
}

export type { AudioSource };
