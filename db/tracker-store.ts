import { env } from 'cloudflare:workers';
import type { BoardData, TrackerMutation } from '@/lib/tracker';
import { makeDefaultBoard } from '@/lib/tracker';
import { applyMutation, isValidEditPassword, type StoredBoard } from '@/lib/tracker-server';

export { isValidEditPassword };

const BOARD_ID = 'main';

type TrackerRow = {
  data: string;
  version: number;
  updated_at: string;
};

function getBinding() {
  if (!env.DB) throw new Error('The tracker database is unavailable.');
  return env.DB;
}

async function ensureTrackerState() {
  const db = getBinding();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tracker_state (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      version INTEGER DEFAULT 1 NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  const now = new Date().toISOString();
  await db.prepare(
    'INSERT OR IGNORE INTO tracker_state (id, data, version, updated_at) VALUES (?, ?, 1, ?)',
  ).bind(BOARD_ID, JSON.stringify(makeDefaultBoard()), now).run();
}

async function readRow(): Promise<TrackerRow> {
  await ensureTrackerState();
  const row = await getBinding()
    .prepare('SELECT data, version, updated_at FROM tracker_state WHERE id = ?')
    .bind(BOARD_ID)
    .first<TrackerRow>();
  if (!row) throw new Error('The tracker could not be loaded.');
  return row;
}

function parseRow(row: TrackerRow): StoredBoard {
  return {
    data: JSON.parse(row.data) as BoardData,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export async function getTracker(): Promise<StoredBoard> {
  return parseRow(await readRow());
}

export async function mutateTracker(mutation: TrackerMutation): Promise<StoredBoard> {
  if (mutation.kind === 'validatePassword') return getTracker();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readRow();
    const nextData = applyMutation(JSON.parse(current.data) as BoardData, mutation);
    const updatedAt = new Date().toISOString();
    const result = await getBinding()
      .prepare('UPDATE tracker_state SET data = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?')
      .bind(JSON.stringify(nextData), current.version + 1, updatedAt, BOARD_ID, current.version)
      .run();

    if ((result.meta.changes || 0) > 0) {
      return { data: nextData, version: current.version + 1, updatedAt };
    }
  }

  throw new Error('The board changed while saving. Please try again.');
}
