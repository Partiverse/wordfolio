// learning.db：用户学习状态库（设备端创建、可写，ADR-0005 D3）。
// 与只读发布物 wordfolio.db 分离；本批只落收藏表，FSRS 状态 M-B 扩展。
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'learning.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function openLearningDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = bootstrap();
  return dbPromise;
}

async function bootstrap(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS favorite (
      entry_id   INTEGER PRIMARY KEY REFERENCES entry (id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export async function getFavoriteEntryIds(): Promise<number[]> {
  const db = await openLearningDb();
  const rows = await db.getAllAsync<{ entry_id: number }>(
    'SELECT entry_id FROM favorite ORDER BY created_at DESC, entry_id DESC',
  );
  return rows.map((r) => r.entry_id);
}

export async function addFavoriteEntry(entryId: number): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync('INSERT OR IGNORE INTO favorite (entry_id) VALUES (?)', [entryId]);
}

export async function removeFavoriteEntry(entryId: number): Promise<void> {
  const db = await openLearningDb();
  await db.runAsync('DELETE FROM favorite WHERE entry_id = ?', [entryId]);
}
