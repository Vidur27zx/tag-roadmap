import type { BoardData, TrackerMutation } from '@/lib/tracker';

export type StoredBoard = {
  data: BoardData;
  version: number;
  updatedAt: string;
};

function cleanText(value: string, field: string, maxLength = 140) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) throw new Error(`${field} cannot be empty.`);
  if (cleaned.length > maxLength) throw new Error(`${field} is too long.`);
  return cleaned;
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function applyMutation(board: BoardData, mutation: TrackerMutation): BoardData {
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
      tasks[makeId('task')] = {
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
