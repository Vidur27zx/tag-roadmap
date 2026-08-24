import { env } from 'cloudflare:workers';
import type { BoardData, TrackerMutation } from '@/lib/tracker';
import { makeDefaultBoard } from '@/lib/tracker';

const BOARD_ID = 'main';

type StoredBoard = {
  data: BoardData;
  version: number;
  updatedAt: string;
};

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

function cleanText(value: string, field: string, maxLength = 140) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) throw new Error(`${field} cannot be empty.`);
  if (cleaned.length > maxLength) throw new Error(`${field} is too long.`);
  return cleaned;
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function applyMutation(board: BoardData, mutation: TrackerMutation): BoardData {
  const milestones = board.milestones.map((milestone) => ({ ...milestone }));
  const tasks = Object.fromEntries(Object.entries(board.tasks).map(([id, task]) => [id, { ...task }]));

  switch (mutation.kind) {
    case 'setStatus': {
      const task = tasks[mutation.taskId];
      if (!task) throw new Error('That task no longer exists.');
      if (!['todo', 'doing', 'done'].includes(mutation.status)) throw new Error('Invalid task status.');
      tasks[mutation.taskId] = {
        ...task,
        status: mutation.status,
        by: cleanText(mutation.actor || 'Someone', 'Name', 60),
        at: new Date().toISOString(),
      };
      return { milestones, tasks };
    }
    case 'renameTask': {
      const task = tasks[mutation.taskId];
      if (!task) throw new Error('That task no longer exists.');
      tasks[mutation.taskId] = { ...task, title: cleanText(mutation.title, 'Task name') };
      return { milestones, tasks };
    }
    case 'addTask': {
      if (!milestones.some((milestone) => milestone.id === mutation.milestoneId)) throw new Error('That milestone no longer exists.');
      const id = makeId('task');
      tasks[id] = {
        milestoneId: mutation.milestoneId,
        title: cleanText(mutation.title, 'Task name'),
        status: 'todo',
        by: '',
        at: '',
      };
      return { milestones, tasks };
    }
    case 'deleteTask': {
      if (!tasks[mutation.taskId]) throw new Error('That task no longer exists.');
      delete tasks[mutation.taskId];
      return { milestones, tasks };
    }
    case 'renameMilestone': {
      const milestone = milestones.find((item) => item.id === mutation.milestoneId);
      if (!milestone) throw new Error('That milestone no longer exists.');
      milestone.title = cleanText(mutation.title, 'Milestone name');
      return { milestones, tasks };
    }
    case 'setMilestoneWeek': {
      const milestone = milestones.find((item) => item.id === mutation.milestoneId);
      if (!milestone) throw new Error('That milestone no longer exists.');
      milestone.week = cleanText(mutation.week, 'Timeline', 40);
      return { milestones, tasks };
    }
    case 'addMilestone': {
      if (!['brand', 'web', 'android', 'ios', 'scale'].includes(mutation.phase)) throw new Error('Invalid project phase.');
      milestones.push({
        id: makeId('milestone'),
        phase: mutation.phase,
        title: cleanText(mutation.title, 'Milestone name'),
        week: cleanText(mutation.week || 'TBD', 'Timeline', 40),
      });
      return { milestones, tasks };
    }
    case 'deleteMilestone': {
      const index = milestones.findIndex((item) => item.id === mutation.milestoneId);
      if (index < 0) throw new Error('That milestone no longer exists.');
      milestones.splice(index, 1);
      Object.entries(tasks).forEach(([id, task]) => {
        if (task.milestoneId === mutation.milestoneId) delete tasks[id];
      });
      return { milestones, tasks };
    }
    case 'validatePassword':
      return { milestones, tasks };
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function isValidEditPassword(value: string) {
  const configuredPassword = process.env.EDIT_PASSWORD;
  if (!configuredPassword) return false;
  const [candidate, expected] = await Promise.all([sha256(value), sha256(configuredPassword)]);
  let difference = candidate.length ^ expected.length;
  for (let index = 0; index < Math.max(candidate.length, expected.length); index += 1) {
    difference |= (candidate.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
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
