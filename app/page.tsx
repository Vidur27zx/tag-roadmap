'use client';

import {
  Check,
  Clock3,
  LayoutList,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UnlockKeyhole,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  nextStatus,
  PHASES,
  STATUS_ORDER,
  type BoardData,
  type Status,
  type TrackerMutation,
  type TrackerResponse,
} from '@/lib/tracker';

const STATUS_LABEL: Record<Status, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
};

function StatusMark({ status, size = 26 }: { status: Status; size?: number }) {
  return (
    <span className={`status-mark ${status}`} style={{ width: size, height: size }} aria-hidden="true">
      {status === 'done' && <Check size={size * 0.62} strokeWidth={3} />}
      {status === 'doing' && <Clock3 size={size * 0.56} strokeWidth={2.7} />}
    </span>
  );
}

function ProgressBar({ value, color, compact = false }: { value: number; color: string; compact?: boolean }) {
  return (
    <div className={`progress-track ${compact ? 'compact' : ''}`}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

function trackerStats(data: BoardData) {
  const byPhase: Record<string, { total: number; done: number; doing: number }> = {};
  PHASES.forEach((phase) => { byPhase[phase.id] = { total: 0, done: 0, doing: 0 }; });
  Object.values(data.tasks).forEach((task) => {
    const milestone = data.milestones.find((item) => item.id === task.milestoneId);
    if (!milestone || !byPhase[milestone.phase]) return;
    byPhase[milestone.phase].total += 1;
    if (task.status === 'done') byPhase[milestone.phase].done += 1;
    if (task.status === 'doing') byPhase[milestone.phase].doing += 1;
  });
  const total = Object.values(byPhase).reduce((sum, phase) => sum + phase.total, 0);
  const done = Object.values(byPhase).reduce((sum, phase) => sum + phase.done, 0);
  return { byPhase, total, done };
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<TrackerResponse | null>(null);
  const [nameReady, setNameReady] = useState(false);
  const [username, setUsername] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [mainView, setMainView] = useState<'simple' | 'team'>('simple');
  const [teamTab, setTeamTab] = useState<'roadmap' | 'board'>('roadmap');
  const [activePhase, setActivePhase] = useState<string>(PHASES[0].id);
  const [editMode, setEditMode] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [newTask, setNewTask] = useState<Record<string, string>>({});
  const [newMilestoneOpen, setNewMilestoneOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneWeek, setNewMilestoneWeek] = useState('');
  const [boardTaskTitle, setBoardTaskTitle] = useState('');
  const [boardMilestone, setBoardMilestone] = useState('');

  const data = snapshot?.data;
  const stats = useMemo(() => data ? trackerStats(data) : null, [data]);

  const loadTracker = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/tracker', { cache: 'no-store' });
      const body = await response.json() as TrackerResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load the board.');
      setSnapshot(body);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the board.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedName = window.localStorage.getItem('gi-market-tracker-name') || '';
      setUsername(savedName);
      setNameInput(savedName);
      setNameReady(true);
      void loadTracker();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadTracker]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && !saving) void loadTracker(true); };
    const interval = window.setInterval(refresh, 12_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadTracker, saving]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const runMutation = useCallback(async (mutation: TrackerMutation, successMessage?: string) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(mutation.kind === 'setStatus' ? {} : { 'x-edit-password': editPassword || passwordInput }),
        },
        body: JSON.stringify(mutation),
      });
      const body = await response.json() as TrackerResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not save that change.');
      setSnapshot(body);
      if (successMessage) setNotice(successMessage);
      return true;
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'Could not save that change.';
      if (/password/i.test(message)) {
        setEditMode(false);
        setEditPassword('');
      }
      setError(message);
      await loadTracker(true);
      return false;
    } finally {
      setSaving(false);
    }
  }, [editPassword, passwordInput, loadTracker]);

  const saveName = () => {
    const cleaned = nameInput.trim().replace(/\s+/g, ' ');
    if (!cleaned) return;
    window.localStorage.setItem('gi-market-tracker-name', cleaned);
    setUsername(cleaned);
  };

  const unlockEditing = async () => {
    setPasswordError('');
    if (!passwordInput) return;
    const success = await runMutation({ kind: 'validatePassword' });
    if (success) {
      setEditPassword(passwordInput);
      setPasswordInput('');
      setPasswordOpen(false);
      setEditMode(true);
      setNotice('Team editing unlocked.');
    } else {
      setPasswordError('That password is not correct.');
      setError('');
    }
  };

  const lockEditing = () => {
    setEditMode(false);
    setEditPassword('');
    setNotice('Team editing locked.');
  };

  const renameTask = (taskId: string, previous: string, next: string) => {
    const cleaned = next.trim();
    if (cleaned && cleaned !== previous) void runMutation({ kind: 'renameTask', taskId, title: cleaned }, 'Task renamed.');
  };

  const renameMilestone = (milestoneId: string, previous: string, next: string) => {
    const cleaned = next.trim();
    if (cleaned && cleaned !== previous) void runMutation({ kind: 'renameMilestone', milestoneId, title: cleaned }, 'Milestone renamed.');
  };

  const updateWeek = (milestoneId: string, previous: string, next: string) => {
    const cleaned = next.trim();
    if (cleaned && cleaned !== previous) void runMutation({ kind: 'setMilestoneWeek', milestoneId, week: cleaned }, 'Timeline updated.');
  };

  const addTask = async (milestoneId: string, fromBoard = false) => {
    const title = (fromBoard ? boardTaskTitle : newTask[milestoneId] || '').trim();
    if (!title) return;
    const success = await runMutation({ kind: 'addTask', milestoneId, title }, 'Task added.');
    if (success) {
      if (fromBoard) setBoardTaskTitle('');
      else setNewTask((current) => ({ ...current, [milestoneId]: '' }));
    }
  };

  const addMilestone = async () => {
    const title = newMilestoneTitle.trim();
    if (!title) return;
    const success = await runMutation({
      kind: 'addMilestone',
      phase: activePhase,
      title,
      week: newMilestoneWeek.trim() || 'TBD',
    }, 'Milestone added.');
    if (success) {
      setNewMilestoneTitle('');
      setNewMilestoneWeek('');
      setNewMilestoneOpen(false);
    }
  };

  const deleteTask = (taskId: string, title: string) => {
    if (window.confirm(`Remove “${title}”? This cannot be undone.`)) {
      void runMutation({ kind: 'deleteTask', taskId }, 'Task removed.');
    }
  };

  const deleteMilestone = (milestoneId: string, title: string) => {
    if (window.confirm(`Remove “${title}” and every task inside it? This cannot be undone.`)) {
      void runMutation({ kind: 'deleteMilestone', milestoneId }, 'Milestone removed.');
    }
  };

  if (!nameReady || loading) {
    return (
      <main className="loading-screen" aria-live="polite">
        <LoaderCircle className="spin" size={24} />
        <span>Loading the shared tracker…</span>
      </main>
    );
  }

  if (!username) {
    return (
      <main className="welcome-screen">
        <section className="welcome-card">
          <p className="eyebrow">GI-Market</p>
          <h1>Project tracker</h1>
          <p>Enter your name so each status update shows who made it.</p>
          <label htmlFor="your-name">Your name</label>
          <input
            id="your-name"
            autoFocus
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') saveName(); }}
            placeholder="e.g. Priya"
            maxLength={60}
          />
          <button className="primary-button" onClick={saveName} type="button">Open tracker</button>
        </section>
      </main>
    );
  }

  if (!data || !stats) {
    return (
      <main className="loading-screen error-screen">
        <p>{error || 'The shared board could not be loaded.'}</p>
        <button className="primary-button" onClick={() => void loadTracker()} type="button">Try again</button>
      </main>
    );
  }

  const overallPct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const activePhaseInfo = PHASES.find((phase) => phase.id === activePhase) || PHASES[0];
  const activeMilestones = data.milestones.filter((milestone) => milestone.phase === activePhase);
  const selectedBoardMilestone = boardMilestone && activeMilestones.some((item) => item.id === boardMilestone)
    ? boardMilestone
    : activeMilestones[0]?.id || '';

  return (
    <main className="tracker-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GI-Market</p>
          <h1>Project progress</h1>
          <p className="subtitle">A clear, shared view of every milestone from brand to launch.</p>
        </div>
        <div className="header-actions">
          <span className="person-chip"><UserRound size={15} /> {username}</span>
          <button className="icon-button" onClick={() => void loadTracker(true)} disabled={saving} title="Refresh board" aria-label="Refresh board" type="button">
            <RefreshCw className={saving ? 'spin' : ''} size={17} />
          </button>
          <button
            className={`edit-button ${editMode ? 'unlocked' : ''}`}
            onClick={() => editMode ? lockEditing() : setPasswordOpen(true)}
            type="button"
          >
            {editMode ? <UnlockKeyhole size={16} /> : <LockKeyhole size={16} />}
            {editMode ? 'Editing' : 'Team edit'}
          </button>
        </div>
      </header>

      <div className="view-switch" role="group" aria-label="Tracker view">
        <button className={mainView === 'simple' ? 'active' : ''} onClick={() => setMainView('simple')} type="button">
          <LayoutList size={16} /> Client view
        </button>
        <button className={mainView === 'team' ? 'active' : ''} onClick={() => setMainView('team')} type="button">
          <UsersRound size={16} /> Team view
        </button>
      </div>

      {(notice || error) && (
        <div className={`notice ${error ? 'error' : ''}`} role="status">
          <span>{error || notice}</span>
          <button onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss message" type="button"><X size={16} /></button>
        </div>
      )}

      <section className="progress-card" aria-label="Overall progress">
        <div className="progress-heading">
          <span>Overall progress</span>
          <strong>{overallPct}% done</strong>
        </div>
        <ProgressBar value={overallPct} color="#B45A38" />
        <div className="progress-meta">
          <span>{stats.done} of {stats.total} tasks complete</span>
          <span>{saving ? 'Saving…' : `Synced ${new Date(snapshot.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`}</span>
        </div>
      </section>

      <nav className="phase-tabs" aria-label="Project phases">
        {PHASES.map((phase) => {
          const phaseStats = stats.byPhase[phase.id];
          const pct = phaseStats.total ? Math.round((phaseStats.done / phaseStats.total) * 100) : 0;
          const active = activePhase === phase.id;
          return (
            <button
              className={active ? 'active' : ''}
              style={active ? { background: phase.color, borderColor: phase.color } : undefined}
              key={phase.id}
              onClick={() => setActivePhase(phase.id)}
              type="button"
            >
              <span>{phase.name}</span>
              <small>{pct}% done</small>
            </button>
          );
        })}
      </nav>

      {mainView === 'simple' && (
        <section className="milestone-list" aria-label={`${activePhaseInfo.name} milestones`}>
          {activeMilestones.map((milestone) => {
            const milestoneTasks = Object.entries(data.tasks).filter(([, task]) => task.milestoneId === milestone.id);
            const completed = milestoneTasks.filter(([, task]) => task.status === 'done').length;
            return (
              <article className="milestone-card" key={milestone.id}>
                <div className="milestone-heading">
                  <div className="editable-heading">
                    {editMode ? (
                      <input
                        className="week-input"
                        key={`${milestone.id}-${milestone.week}`}
                        defaultValue={milestone.week}
                        onBlur={(event) => updateWeek(milestone.id, milestone.week, event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                        aria-label={`Timeline for ${milestone.title}`}
                        maxLength={40}
                      />
                    ) : <p style={{ color: activePhaseInfo.color }}>{milestone.week}</p>}
                    {editMode ? (
                      <input
                        className="milestone-title-input"
                        key={`${milestone.id}-${milestone.title}`}
                        defaultValue={milestone.title}
                        onBlur={(event) => renameMilestone(milestone.id, milestone.title, event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                        aria-label="Milestone name"
                        maxLength={140}
                      />
                    ) : <h2>{milestone.title}</h2>}
                  </div>
                  <div className="milestone-tools">
                    <span>{completed} / {milestoneTasks.length}</span>
                    {editMode && (
                      <button className="danger-icon" onClick={() => deleteMilestone(milestone.id, milestone.title)} aria-label={`Delete ${milestone.title}`} title="Delete milestone" type="button">
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="task-list">
                  {milestoneTasks.map(([taskId, task]) => (
                    <div className={`task-row ${task.status}`} key={taskId}>
                      <button
                        className="status-button"
                        onClick={() => void runMutation({ kind: 'setStatus', taskId, status: nextStatus(task.status), actor: username })}
                        aria-label={`Move ${task.title} from ${STATUS_LABEL[task.status]} to ${STATUS_LABEL[nextStatus(task.status)]}`}
                        title="Move to next status"
                        type="button"
                      >
                        <StatusMark status={task.status} />
                      </button>
                      <div className="task-copy">
                        {editMode ? (
                          <input
                            className="task-title-input"
                            key={`${taskId}-${task.title}`}
                            defaultValue={task.title}
                            onBlur={(event) => renameTask(taskId, task.title, event.target.value)}
                            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                            aria-label="Task name"
                            maxLength={140}
                          />
                        ) : <span>{task.title}</span>}
                        {task.by && task.status !== 'todo' && (
                          <small>{task.status === 'done' ? 'Completed' : 'Started'} by {task.by}</small>
                        )}
                      </div>
                      {editMode && (
                        <button className="muted-icon" onClick={() => deleteTask(taskId, task.title)} aria-label={`Delete ${task.title}`} title="Delete task" type="button">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {editMode && (
                  <div className="add-row">
                    <input
                      value={newTask[milestone.id] || ''}
                      onChange={(event) => setNewTask((current) => ({ ...current, [milestone.id]: event.target.value }))}
                      onKeyDown={(event) => { if (event.key === 'Enter') void addTask(milestone.id); }}
                      placeholder="Add a task"
                      aria-label={`Add task to ${milestone.title}`}
                      maxLength={140}
                    />
                    <button className="small-primary" onClick={() => void addTask(milestone.id)} type="button"><Plus size={15} /> Add</button>
                  </div>
                )}
              </article>
            );
          })}

          {editMode && (
            <article className="new-milestone-card">
              {!newMilestoneOpen ? (
                <button className="add-milestone-trigger" onClick={() => setNewMilestoneOpen(true)} type="button"><Plus size={17} /> Add milestone to {activePhaseInfo.name}</button>
              ) : (
                <div className="new-milestone-form">
                  <input value={newMilestoneWeek} onChange={(event) => setNewMilestoneWeek(event.target.value)} placeholder="Timeline (e.g. Wk 5)" aria-label="New milestone timeline" maxLength={40} />
                  <input value={newMilestoneTitle} onChange={(event) => setNewMilestoneTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addMilestone(); }} placeholder="Milestone name" aria-label="New milestone name" maxLength={140} />
                  <button className="small-primary" onClick={() => void addMilestone()} type="button">Add milestone</button>
                  <button className="icon-button" onClick={() => setNewMilestoneOpen(false)} aria-label="Cancel" type="button"><X size={16} /></button>
                </div>
              )}
            </article>
          )}

          {!activeMilestones.length && !editMode && <p className="empty-state">No milestones have been added to this phase yet.</p>}
          <p className="helper-copy">Select a task box to move it from to do → in progress → done.</p>
        </section>
      )}

      {mainView === 'team' && (
        <section className="team-area">
          <div className="team-tabs" role="tablist" aria-label="Team views">
            <button className={teamTab === 'roadmap' ? 'active' : ''} onClick={() => setTeamTab('roadmap')} type="button" role="tab">Roadmap</button>
            <button className={teamTab === 'board' ? 'active' : ''} onClick={() => setTeamTab('board')} type="button" role="tab">Board</button>
          </div>

          {teamTab === 'roadmap' && (
            <div className="roadmap-list">
              {PHASES.map((phase) => {
                const phaseStats = stats.byPhase[phase.id];
                const pct = phaseStats.total ? (phaseStats.done / phaseStats.total) * 100 : 0;
                return (
                  <article className="roadmap-phase" key={phase.id} style={{ '--phase-color': phase.color } as CSSProperties}>
                    <div className="roadmap-heading">
                      <div><p>{phase.name}</p><span>{phaseStats.done} of {phaseStats.total} complete</span></div>
                      <strong>{Math.round(pct)}%</strong>
                    </div>
                    <ProgressBar value={pct} color={phase.color} compact />
                    <div className="roadmap-cards">
                      {data.milestones.filter((item) => item.phase === phase.id).map((milestone) => {
                        const tasks = Object.values(data.tasks).filter((task) => task.milestoneId === milestone.id);
                        const done = tasks.filter((task) => task.status === 'done').length;
                        return (
                          <div className="roadmap-card" key={milestone.id}>
                            <small>{milestone.week}</small>
                            <strong>{milestone.title}</strong>
                            <span>{done} / {tasks.length} tasks</span>
                            <ProgressBar value={tasks.length ? (done / tasks.length) * 100 : 0} color={phase.color} compact />
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {teamTab === 'board' && (
            <div className="kanban-board">
              {STATUS_ORDER.map((status) => {
                const tasks = Object.entries(data.tasks).filter(([, task]) => {
                  const milestone = data.milestones.find((item) => item.id === task.milestoneId);
                  return milestone?.phase === activePhase && task.status === status;
                });
                return (
                  <article className="kanban-column" key={status}>
                    <header><StatusMark status={status} size={20} /><strong>{STATUS_LABEL[status]}</strong><span>{tasks.length}</span></header>
                    <div className="kanban-tasks">
                      {tasks.map(([taskId, task]) => {
                        const milestone = data.milestones.find((item) => item.id === task.milestoneId);
                        return (
                          <div className="kanban-task" key={taskId} style={{ borderLeftColor: activePhaseInfo.color }}>
                            <small>{milestone?.week} · {milestone?.title}</small>
                            <p>{task.title}</p>
                            {task.by && task.status !== 'todo' && <span>{task.status === 'done' ? 'Completed' : 'Started'} by {task.by}</span>}
                            <div className="kanban-actions">
                              <button onClick={() => void runMutation({ kind: 'setStatus', taskId, status: nextStatus(task.status), actor: username })} type="button">Move to {STATUS_LABEL[nextStatus(task.status)]}</button>
                              {editMode && <button className="danger-icon" onClick={() => deleteTask(taskId, task.title)} aria-label={`Delete ${task.title}`} type="button"><Trash2 size={15} /></button>}
                            </div>
                          </div>
                        );
                      })}
                      {!tasks.length && <p className="column-empty">Nothing here</p>}
                    </div>
                    {editMode && status === 'todo' && (
                      <div className="board-add">
                        <select value={selectedBoardMilestone} onChange={(event) => setBoardMilestone(event.target.value)} aria-label="Milestone for new task">
                          {activeMilestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.week} · {milestone.title}</option>)}
                        </select>
                        <div>
                          <input value={boardTaskTitle} onChange={(event) => setBoardTaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && selectedBoardMilestone) void addTask(selectedBoardMilestone, true); }} placeholder="Add a task" maxLength={140} />
                          <button className="small-primary" onClick={() => { if (selectedBoardMilestone) void addTask(selectedBoardMilestone, true); }} aria-label="Add task" type="button"><Plus size={15} /></button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {passwordOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasswordOpen(false); }}>
          <section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title">
            <button className="modal-close" onClick={() => setPasswordOpen(false)} aria-label="Close" type="button"><X size={18} /></button>
            <span className="modal-icon"><Pencil size={22} /></span>
            <h2 id="password-title">Unlock team editing</h2>
            <p>Add, rename, or remove milestones and tasks. Status updates stay available in client view.</p>
            <label htmlFor="edit-password">Team password</label>
            <input
              id="edit-password"
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(event) => { setPasswordInput(event.target.value); setPasswordError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter') void unlockEditing(); }}
              aria-invalid={Boolean(passwordError)}
            />
            {passwordError && <span className="field-error">{passwordError}</span>}
            <button className="primary-button" onClick={() => void unlockEditing()} disabled={saving} type="button">
              {saving ? <LoaderCircle className="spin" size={17} /> : <UnlockKeyhole size={17} />}
              Unlock editing
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
