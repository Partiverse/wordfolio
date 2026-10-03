// 真人发音（内测反馈「发音无效，考虑从韦氏词典获取」）：
// 供应商链：韦氏 Collegiate（配了 EXPO_PUBLIC_MW_API_KEY 时优先，真人读音）
//          → Free Dictionary API（dictionaryapi.dev，免 key，聚合真人读音）
//          → 都失败返回 null，调用方回退 TTS。
// 结果缓存 learning.db（audio_cache 表），同词二次播放不再联网，也为离线重听留底。
//
// 韦氏 key 免费注册：https://dictionaryapi.com（Collegiate Dictionary）。
// key 经 EXPO_PUBLIC_MW_API_KEY 环境变量进 bundle（公开变量，非机密；额度在韦氏侧限流）。

const MW_KEY = process.env.EXPO_PUBLIC_MW_API_KEY;
const MW_BASE = 'https://www.dictionaryapi.com/api/v3/references/collegiate/json';
const MW_AUDIO_BASE = 'https://media.merriam-webster.com/audio/prons/en/us/mp3';
const FREE_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const FETCH_TIMEOUT_MS = 5000;

export type AudioSource = 'merriam-webster' | 'free-dictionary' | 'cache';

const memoryCache = new Map<string, string | null>();

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

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

async function resolveRemote(word: string): Promise<{ url: string; source: Exclude<AudioSource, 'cache'> } | null> {
  if (MW_KEY) {
    try {
      const url = resolveMwUrl(await fetchJson(`${MW_BASE}/${encodeURIComponent(word.toLowerCase())}?key=${MW_KEY}`));
      if (url) return { url, source: 'merriam-webster' };
    } catch {
      // 落到免费链路
    }
  }
  try {
    const url = resolveFreeUrl(await fetchJson(`${FREE_BASE}/${encodeURIComponent(word.toLowerCase())}`));
    if (url) return { url, source: 'free-dictionary' };
  } catch {
    // 都失败
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
