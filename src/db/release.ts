// 发布物 DB 引导与只读访问（Spike S1/S3 实现，ADR-0005 D3）。
// 流程：expo-asset 加载打包内 wordfolio.db → 按 edition 决策拷贝到
// expo-sqlite 默认目录 → 只读打开 → 暴露 FTS5 检索。

import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
// SDK 54+ 新 API 在 'expo-file-system'，文件级 legacy API 收敛到 /legacy 子路径
import * as FileSystem from 'expo-file-system/legacy';
import { resolveBootstrapAction } from './upgrade';

// 与 assets/db/wordfolio.db 同步手工维护；发版脚本生成时改由脚本注入
export const BUNDLED_EDITION = 'v0.1-m1';

const DB_NAME = 'wordfolio.db';

export interface ReleaseMeta {
  edition: string;
  generatedAt: string;
  wordCount: number;
  senseCount: number;
  fts5Available: boolean;
  action: BootstrapActionLabel;
}

type BootstrapActionLabel = 'copy' | 'recopy' | 'reuse';

export interface SearchHit {
  stableId: string;
  headword: string;
  pos: string;
  definitionZh: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function openReleaseDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = bootstrap();
  return dbPromise;
}

async function bootstrap(): Promise<SQLite.SQLiteDatabase> {
  const asset = Asset.fromModule(require('../../assets/db/wordfolio.db'));
  await asset.downloadAsync();

  let sandboxEdition: string | null = null;
  const target = FileSystem.documentDirectory + 'SQLite/' + DB_NAME;
  const info = await FileSystem.getInfoAsync(target);
  if (info.exists) {
    try {
      const probe = await SQLite.openDatabaseAsync(DB_NAME);
      const row = await probe.getFirstAsync<{ value: string }>(
        "SELECT value FROM meta WHERE key = 'edition'",
      );
      sandboxEdition = row?.value ?? null;
      await probe.closeAsync();
    } catch {
      sandboxEdition = null;
    }
  }

  const action = resolveBootstrapAction(sandboxEdition, BUNDLED_EDITION);
  if (action !== 'reuse') {
    if (action === 'recopy') {
      await FileSystem.deleteAsync(target, { idempotent: true });
    }
    await FileSystem.makeDirectoryAsync(
      FileSystem.documentDirectory + 'SQLite/',
      { intermediates: true },
    );
    await FileSystem.copyAsync({ from: asset.localUri ?? asset.uri, to: target });
  }

  return SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: false });
}

export async function readReleaseMeta(): Promise<ReleaseMeta> {
  const db = await openReleaseDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM meta',
  );
  const meta = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const fts = await db.getFirstAsync<{ ok: number }>(
    "SELECT sqlite_compileoption_used('ENABLE_FTS5') AS ok",
  );
  return {
    edition: meta['edition'] ?? '?',
    generatedAt: meta['generated_at'] ?? '?',
    wordCount: Number(meta['word_count'] ?? 0),
    senseCount: Number(meta['sense_count'] ?? 0),
    fts5Available: fts?.ok === 1,
    action: 'reuse',
  };
}

// FTS5 检索：词头走 entry 前缀查询，中文释义/英文定义走 sense_fts MATCH
export async function searchSenses(query: string, limit = 20): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const db = await openReleaseDb();
  const hasCjk = /[\u4e00-\u9fff]/.test(q);
  const match = hasCjk ? `"${q}"` : `"${q}"*`;
  return db.getAllAsync<SearchHit>(
    `SELECT s.stable_id AS stableId,
            e.headword   AS headword,
            s.pos        AS pos,
            s.definition_zh AS definitionZh
       FROM sense_fts f
       JOIN sense s ON s.id = f.rowid
       JOIN entry e ON e.id = s.entry_id
      WHERE sense_fts MATCH ?
      ORDER BY bm25(sense_fts)
      LIMIT ?`,
    [match, limit],
  );
}

export async function getEntryHeadwords(prefix: string, limit = 20): Promise<string[]> {
  const db = await openReleaseDb();
  const rows = await db.getAllAsync<{ headword: string }>(
    'SELECT headword FROM entry WHERE headword LIKE ? || \'%\' ORDER BY freq_rank IS NULL, freq_rank LIMIT ?',
    [prefix.trim(), limit],
  );
  return rows.map((r) => r.headword);
}
