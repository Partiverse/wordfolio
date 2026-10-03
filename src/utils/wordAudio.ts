// 真人发音播放：resolveAudioUrl（韦氏→免费词典链，见 ./pronunciation.ts）→ expo-audio 播放，
// 失败回退 TTS（原 expo-speech 路径）。
// 实测坑（beta.5）：音频 CDN（dictionaryapi.dev 的 media 主机 / 韦氏 media 主机）在部分
// 网络（尤其国内无代理环境）不可达，ExoPlayer 会永远停在 BUFFERING——所以必须做就绪
// 超时：4.5s 内没 loaded 就销毁播放器回退 TTS，绝不卡死。URL 缓存命中也无法幸免 CDN
// 不可达，所以超时兜底在缓存路径同样生效。
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { resolveAudioUrl, type AudioSource } from './pronunciation';
import { speakEn } from './speech';

let modeReady = false;

async function ensureMode(): Promise<void> {
  if (!modeReady) {
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    modeReady = true;
  }
}

const READY_TIMEOUT_MS = 4500;
const POLL_INTERVAL_MS = 250;

function waitUntilLoaded(player: AudioPlayer): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (player.isLoaded) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= READY_TIMEOUT_MS) {
        clearInterval(timer);
        resolve(false);
      }
    }, POLL_INTERVAL_MS);
  });
}

function releasePlayer(player: AudioPlayer): void {
  try {
    player.remove();
  } catch {
    try {
      player.release();
    } catch {
      // 已释放
    }
  }
}

export type PlayResult = 'audio' | 'tts' | 'failed';

/** 播放词头发音：优先真人语音，加载超时/失败回退 TTS。返回实际来源供调试与埋点。 */
export async function playWordAudio(word: string): Promise<PlayResult> {
  const resolved = await resolveAudioUrl(word).catch(() => null);
  if (resolved) {
    let player: AudioPlayer | null = null;
    try {
      await ensureMode();
      player = createAudioPlayer(resolved.url);
      const loaded = await waitUntilLoaded(player);
      if (loaded) {
        player.play();
        return 'audio';
      }
      releasePlayer(player);
      player = null;
    } catch {
      if (player) releasePlayer(player);
      player = null;
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
