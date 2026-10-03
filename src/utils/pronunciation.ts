// 真人发音（内测反馈「发音无效」→「改用有道的免费 api」）：
// 供应商链（2026-10-03 重排，有道首选）：
//   1. 有道 dictvoice（dict.youdao.com，国内 CDN、免 key，实测 0.13–0.25s 返回
//      128kbps 真 MP3——韦氏 media 主机的 1/20 延迟且稳定）
//   2. 韦氏 Learner's（EXPO_PUBLIC_MW_API_KEY，真人录音，质量最优但 media CDN
//      国内时通时断）——有道构造即得 URL，实际仅在显式调换顺序时生效
//   3. Free Dictionary API（dictionaryapi.dev，免 key；media 主机国内不可达）
//   → 都失败返回 null，调用方回退 TTS。
// 结果缓存 learning.db（audio_cache 表），同词二次播放不再联网。
// 注：有道接口为词典网页端点（非官方开放 API），内测流量可接受；若日后失效，
// 调换 PROVIDER 顺序回到韦氏即可，调用方无感。

const MW_KEY = process.env.EXPO_PUBLIC_MW_API_KEY;
const MW_BASE = 'https://www.dictionaryapi.com/api/v3/references/learners/json';
const MW_AUDIO_BASE = 'https://media.merriam-webster.com/audio/prons/en/us/mp3';
const FREE_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const YOUDAO_BASE = 'https://dict.youdao.com/dictvoice';
const FETCH_TIMEOUT_MS = 5000;

// 注意：不能用 AbortSignal.timeout——Hermes 引擎未实现该 API，设备上会直接抛
// TypeError，把两个音频源全部打死、静默回退到（可能不存在的）TTS，即内测反馈的
// 「发音无效」。用 Promise.race + setTimeout 做 Hermes 兼容的超时。
function timeoutGuard<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)),
  ]);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await timeoutGuard(fetch(url), FETCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type AudioSource = 'youdao' | 'merriam-webster' | 'free-dictionary' | 'cache';

const memoryCache = new Map<string, string | null>();

/** 韦氏：取第一个带 audio 的 prs（美音真人读音）。 */
function resolveMwUrl(payload: unknown): string | null {
  const entries = Array.isArray(payload) ? payload : [];
  for (const entry of entries) {
    const hwi = (entry as { hwi?: { prs?: { sound?: { audio?: string } }[] } }).hwi;
    const audio = hwi?.prs?.find((p) => p.sound?.audio)?.sound?.audio;
    if (!audio) continue;
    // 韦氏文件名规则：bix/gerry 开头归二/三层目录，其余首字母
    const dir = /^bix/.test(audio) ? 'bix' : /^gerry/.test(audio) ? 'gerry' : /^[^a-z]/.test(audio) ? 'number' : audio[0];
    return `${MW_AUDIO_BASE}/${dir}/${audio}.mp3`;
  }
  return null;
}

/** Free Dictionary API：优先美音，其次任意带 audio 的项。 */
function resolveFreeUrl(payload: unknown): string | null {
  const entries = Array.isArray(payload) ? payload : [];
  for (const entry of entries) {
    const phonetics = (entry as { phonetics?: { audio?: string; text?: string }[] }).phonetics ?? [];
    const urls = phonetics.filter((p) => p.audio).map((p) => p.audio as string);
    if (urls.length === 0) continue;
    return urls.find((u) => /-us\b|-american/.test(u)) ?? urls[0];
  }
  return null;
}

/** 有道 dictvoice：URL 构造即得（type=2 美音），国内 CDN 最稳最快。 */
function youdaoProvider(word: string): { url: string; source: Exclude<AudioSource, 'cache'> } {
  return { url: `${YOUDAO_BASE}?type=2&audio=${encodeURIComponent(word)}`, source: 'youdao' };
}

async function mwProvider(word: string): Promise<{ url: string; source: Exclude<AudioSource, 'cache'> } | null> {
  if (!MW_KEY) return null;
  const url = resolveMwUrl(await fetchJson(`${MW_BASE}/${encodeURIComponent(word.toLowerCase())}?key=${MW_KEY}`));
  return url ? { url, source: 'merriam-webster' } : null;
}

async function freeProvider(word: string): Promise<{ url: string; source: Exclude<AudioSource, 'cache'> } | null> {
  const url = resolveFreeUrl(await fetchJson(`${FREE_BASE}/${encodeURIComponent(word.toLowerCase())}`));
  return url ? { url, source: 'free-dictionary' } : null;
}

// 顺序即优先级：有道（国内稳）→ 韦氏（录音质量最优，key 缺失时自动跳过）→ 免费词典
const PROVIDERS = [youdaoProvider, mwProvider, freeProvider] as const;

async function resolveRemote(word: string): Promise<{ url: string; source: Exclude<AudioSource, 'cache'> } | null> {
  for (const provider of PROVIDERS) {
    try {
      const hit = await provider(word);
      if (hit) return hit;
    } catch {
      // 尝试下一个源
    }
  }
  return null;
}

// learning.db 缓存由 db/study.ts 注入，避免本模块依赖 SQLite（保持可单测）
let cacheGet: ((word: string) => Promise<string | null>) | null = null;
let cachePut: ((word: string, url: string) => void) | null = null;

export function bindAudioCache(
  get: (word: string) => Promise<string | null>,
  put: (word: string, url: string) => void,
): void {
  cacheGet = get;
  cachePut = put;
}

/** 解析词头真人发音 URL；失败返回 null（调用方回退 TTS）。 */
export async function resolveAudioUrl(word: string): Promise<{ url: string; source: AudioSource } | null> {
  const key = word.trim().toLowerCase();
  if (!key) return null;
  if (memoryCache.has(key)) {
    const url = memoryCache.get(key);
    return url ? { url, source: 'cache' } : null;
  }
  const cached = (await cacheGet?.(key)) ?? null;
  if (cached) {
    memoryCache.set(key, cached);
    return { url: cached, source: 'cache' };
  }

  const resolved = await resolveRemote(key);
  memoryCache.set(key, resolved?.url ?? null);
  if (resolved) cachePut?.(key, resolved.url);
  return resolved;
}
