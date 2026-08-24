import { neon } from '@neondatabase/serverless';
import type { BoardData, TrackerMutation } from '@/lib/tracker';
import { makeDefaultBoard } from '@/lib/tracker';
import { applyMutation, isValidEditPassword, type StoredBoard } from '@/lib/tracker-server';

export { isValidEditPassword };

const BOARD_ID = 'main';

type TrackerRow = {
  data: BoardData | string;
  version: number;
  updated_at: string | Date;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured. Connect a Postgres database in Vercel.');
  return neon(databaseUrl);
}

async function ensureTrackerState() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS tracker_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  const now = new Date().toISOString();
  const initialData = JSON.stringify(makeDefaultBoard());
  await sql.query(
    `INSERT INTO tracker_state (id, data, version, updated_at)
     VALUES ($1, $2::jsonb, 1, $3)
     ON CONFLICT (id) DO NOTHING`,
    [BOARD_ID, initialData, now],
  );
}

function parseRow(row: TrackerRow): StoredBoard {
  return {
    data: typeof row.data === 'string' ? JSON.parse(row.data) as BoardData : row.data,
    version: Number(row.version),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

async function readRow(): Promise<TrackerRow> {
  await ensureTrackerState();
  const rows = await getSql().query(
    'SELECT data, version, updated_at FROM tracker_state WHERE id = $1',
    [BOARD_ID],
  );
  const row = rows[0] as TrackerRow | undefined;
  if (!row) throw new Error('The tracker could not be loaded.');
  return row;
}

export async function getTracker(): Promise<StoredBoard> {
  return parseRow(await readRow());
}

export async function mutateTracker(mutation: TrackerMutation): Promise<StoredBoard> {
  if (mutation.kind === 'validatePassword') return getTracker();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readRow();
    const currentData = typeof current.data === 'string' ? JSON.parse(current.data) as BoardData : current.data;
    const nextData = applyMutation(currentData, mutation);
    const updatedAt = new Date().toISOString();
    const rows = await getSql().query(
      `UPDATE tracker_state
       SET data = $1::jsonb, version = $2, updated_at = $3
       WHERE id = $4 AND version = $5
       RETURNING version`,
      [JSON.stringify(nextData), Number(current.version) + 1, updatedAt, BOARD_ID, Number(current.version)],
    );

    if (rows.length > 0) {
      return { data: nextData, version: Number(current.version) + 1, updatedAt };
    }
  }

  throw new Error('The board changed while saving. Please try again.');
}
