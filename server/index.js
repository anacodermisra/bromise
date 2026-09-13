'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const db = require('./db');
const { verifyGoogleTokenAndGetUser, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Set Content Security Policy headers for Google OAuth and resources
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "frame-src 'self' https://accounts.google.com; " +
    "connect-src 'self' https://accounts.google.com https://*.turso.io https://*.onrender.com; " +
    "img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com;"
  );
  next();
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function nowISO() { return new Date().toISOString(); }
function uid() { return randomUUID(); }

// Row mappers: snake_case DB → camelCase JSON
function mapCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    accent: row.accent,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived ? row.updated_at : null,
  };
}

function mapTask(row, recurrenceRow) {
  if (!row) return null;
  const task = {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    notes: row.notes || undefined,
    priority: row.priority,
    deadline: row.deadline || undefined,
    isRecurring: !!row.is_recurring,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived ? row.updated_at : null,
  };
  if (recurrenceRow) {
    task.recurrenceRule = {
      id: recurrenceRow.id,
      taskId: recurrenceRow.task_id,
      frequency: recurrenceRow.frequency,
      startDate: recurrenceRow.start_date,
      endDate: recurrenceRow.end_date || undefined,
      active: !!recurrenceRow.active,
    };
  }
  return task;
}

function mapPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    position: row.position,
    sourceType: row.source_type,
  };
}

function mapCompletion(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    completed: !!row.completed,
    completedAt: row.completed_at || undefined,
  };
}

function mapSubtask(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    done: !!row.done,
    position: row.position,
    createdAt: row.created_at,
  };
}

// ─────────────────────────────────────────
// HEALTH & AUTH
// ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: nowISO() });
});

// Google Authentication Route
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential token' });

    const { user, token } = await verifyGoogleTokenAndGetUser(credential);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Failed to authenticate with Google: ' + err.message });
  }
});

// Get Current User Profile
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const userResult = await db.execute({ sql: 'SELECT id, email, name, picture, created_at FROM users WHERE id = ?', args: [req.userId] });
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ─────────────────────────────────────────
// CATEGORIES (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/categories', requireAuth, async (req, res) => {
  const result = await db.execute({ sql: 'SELECT * FROM categories WHERE user_id = ? AND archived = 0 ORDER BY position ASC', args: [req.userId] });
  res.json(result.rows.map(mapCategory));
});

app.post('/api/categories', requireAuth, async (req, res) => {
  const { name, icon = 'Sparkles', accent = '#8b5cf6' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const maxPosResult = await db.execute({ sql: 'SELECT COALESCE(MAX(position), -1) as m FROM categories WHERE user_id = ?', args: [req.userId] });
  const maxPos = maxPosResult.rows[0].m;
  const id = req.body.id || `cat-${uid()}`;
  const now = nowISO();
  await db.execute({ sql: 'INSERT INTO categories (id,user_id,name,icon,accent,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', args: [id, req.userId, name, icon, accent, maxPos + 1, now, now] });
  const rowResult = await db.execute({ sql: 'SELECT * FROM categories WHERE id=? AND user_id=?', args: [id, req.userId] });
  res.status(201).json(mapCategory(rowResult.rows[0]));
});

app.put('/api/categories/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const existingResult = await db.execute({ sql: 'SELECT * FROM categories WHERE id=? AND user_id=?', args: [id, req.userId] });
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'not found' });
  const now = nowISO();
  const name = req.body.name ?? existing.name;
  const icon = req.body.icon ?? existing.icon;
  const accent = req.body.accent ?? existing.accent;
  const position = req.body.position ?? existing.position;
  await db.execute({ sql: 'UPDATE categories SET name=?,icon=?,accent=?,position=?,updated_at=? WHERE id=? AND user_id=?', args: [name, icon, accent, position, now, id, req.userId] });
  const rowResult = await db.execute({ sql: 'SELECT * FROM categories WHERE id=? AND user_id=?', args: [id, req.userId] });
  res.json(mapCategory(rowResult.rows[0]));
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { action, targetCategoryId } = req.body;
  const checkResult = await db.execute({ sql: 'SELECT id FROM categories WHERE id=? AND user_id=?', args: [id, req.userId] });
  if (!checkResult.rows[0]) {
    return res.status(404).json({ error: 'not found' });
  }
  if (action === 'move' && targetCategoryId) {
    await db.execute({ sql: 'UPDATE tasks SET category_id=?, updated_at=? WHERE category_id=? AND user_id=?', args: [targetCategoryId, nowISO(), id, req.userId] });
  } else {
    // delete tasks in this category
    const tasksResult = await db.execute({ sql: 'SELECT id FROM tasks WHERE category_id=? AND user_id=?', args: [id, req.userId] });
    const taskIds = tasksResult.rows.map(r => r.id);
    for (const tid of taskIds) {
      await db.execute({ sql: 'DELETE FROM daily_plans WHERE task_id=? AND user_id=?', args: [tid, req.userId] });
      await db.execute({ sql: 'DELETE FROM completions WHERE task_id=? AND user_id=?', args: [tid, req.userId] });
      await db.execute({ sql: 'DELETE FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [tid, req.userId] });
    }
    await db.execute({ sql: 'DELETE FROM tasks WHERE category_id=? AND user_id=?', args: [id, req.userId] });
  }
  const now = nowISO();
  // Re-index positions
  const remainingResult = await db.execute({ sql: 'SELECT id FROM categories WHERE id != ? AND user_id=? ORDER BY position ASC', args: [id, req.userId] });
  const remaining = remainingResult.rows;
  for (let i = 0; i < remaining.length; i++) {
    const r = remaining[i];
    await db.execute({ sql: 'UPDATE categories SET position=?,updated_at=? WHERE id=? AND user_id=?', args: [i, now, r.id, req.userId] });
  }
  await db.execute({ sql: 'DELETE FROM categories WHERE id=? AND user_id=?', args: [id, req.userId] });
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// TASKS (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/tasks', requireAuth, async (req, res) => {
  const tasksResult = await db.execute({ sql: 'SELECT * FROM tasks WHERE user_id=? ORDER BY created_at ASC', args: [req.userId] });
  const tasks = tasksResult.rows;
  const result = [];
  for (const t of tasks) {
    const recResult = await db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [t.id, req.userId] });
    const rec = recResult.rows[0];
    const subtasksResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE task_id=? AND user_id=? ORDER BY position ASC', args: [t.id, req.userId] });
    const subtasks = subtasksResult.rows;
    const mapped = mapTask(t, rec);
    mapped.subtasks = subtasks.map(mapSubtask);
    result.push(mapped);
  }
  res.json(result);
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  const { title, categoryId, notes, priority = 'medium', deadline, isRecurring = false, recurrenceRule } = req.body;
  if (!title || !categoryId) return res.status(400).json({ error: 'title and categoryId required' });
  const id = req.body.id || `task-${uid()}`;
  const now = nowISO();
  await db.execute({ sql: 'INSERT INTO tasks (id,user_id,category_id,title,notes,priority,deadline,is_recurring,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', args: [id, req.userId, categoryId, title, notes || null, priority, deadline || null, isRecurring ? 1 : 0, now, now] });
  let rec = null;
  if (isRecurring) {
    const recId = (recurrenceRule && recurrenceRule.id) || `rec-${uid()}`;
    const startDate = (recurrenceRule && recurrenceRule.startDate) || now.split('T')[0];
    await db.execute({ sql: 'INSERT INTO recurrence_rules (id,user_id,task_id,frequency,start_date,active) VALUES (?,?,?,?,?,?)', args: [recId, req.userId, id, 'daily', startDate, 1] });
    const recResult = await db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [id, req.userId] });
    rec = recResult.rows[0];
  }
  const taskResult = await db.execute({ sql: 'SELECT * FROM tasks WHERE id=? AND user_id=?', args: [id, req.userId] });
  res.status(201).json(mapTask(taskResult.rows[0], rec));
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const existingResult = await db.execute({ sql: 'SELECT * FROM tasks WHERE id=? AND user_id=?', args: [id, req.userId] });
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'not found' });
  const now = nowISO();
  const title = req.body.title ?? existing.title;
  const categoryId = req.body.categoryId ?? existing.category_id;
  const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;
  const priority = req.body.priority ?? existing.priority;
  const deadline = req.body.deadline !== undefined ? req.body.deadline : existing.deadline;
  const isRecurring = req.body.isRecurring !== undefined ? (req.body.isRecurring ? 1 : 0) : existing.is_recurring;
  await db.execute({ sql: 'UPDATE tasks SET category_id=?,title=?,notes=?,priority=?,deadline=?,is_recurring=?,updated_at=? WHERE id=? AND user_id=?', args: [categoryId, title, notes || null, priority, deadline || null, isRecurring, now, id, req.userId] });
  if (req.body.recurrenceRule && isRecurring) {
    const rr = req.body.recurrenceRule;
    const existingRecResult = await db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [id, req.userId] });
    const existing_rec = existingRecResult.rows[0];
    if (existing_rec) {
      await db.execute({ sql: 'UPDATE recurrence_rules SET frequency=?,start_date=?,end_date=?,active=? WHERE task_id=? AND user_id=?', args: [rr.frequency || 'daily', rr.startDate || existing_rec.start_date, rr.endDate || null, rr.active !== false ? 1 : 0, id, req.userId] });
    } else {
      await db.execute({ sql: 'INSERT INTO recurrence_rules (id,user_id,task_id,frequency,start_date,active) VALUES (?,?,?,?,?,?)', args: [`rec-${uid()}`, req.userId, id, rr.frequency || 'daily', rr.startDate || now.split('T')[0], 1] });
    }
  } else if (!isRecurring) {
    await db.execute({ sql: 'UPDATE recurrence_rules SET active=0 WHERE task_id=? AND user_id=?', args: [id, req.userId] });
  }
  const taskResult = await db.execute({ sql: 'SELECT * FROM tasks WHERE id=? AND user_id=?', args: [id, req.userId] });
  const recResult = await db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [id, req.userId] });
  res.json(mapTask(taskResult.rows[0], recResult.rows[0]));
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const taskCheck = await db.execute({ sql: 'SELECT id FROM tasks WHERE id=? AND user_id=?', args: [id, req.userId] });
  if (!taskCheck.rows[0]) {
    return res.status(404).json({ error: 'not found' });
  }
  const today = new Date().toISOString().split('T')[0];
  await db.execute({ sql: 'DELETE FROM subtasks WHERE task_id=?', args: [id] });
  await db.execute({ sql: "DELETE FROM daily_plans WHERE task_id=? AND user_id=? AND date > ?", args: [id, req.userId, today] });
  await db.execute({ sql: 'UPDATE tasks SET archived=1, updated_at=? WHERE id=? AND user_id=?', args: [nowISO(), id, req.userId] });
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// SUBTASKS
// ─────────────────────────────────────────
app.get('/api/tasks/:taskId/subtasks', requireAuth, async (req, res) => {
  const userId = req.userId;
  const { taskId } = req.params;
  const rowsResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE task_id=? AND user_id=? ORDER BY position ASC', args: [taskId, userId] });
  res.json(rowsResult.rows.map(mapSubtask));
});

app.post('/api/tasks/:taskId/subtasks', requireAuth, async (req, res) => {
  const userId = req.userId;
  const { taskId } = req.params;
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
  // Verify task belongs to user
  const taskResult = await db.execute({ sql: 'SELECT id FROM tasks WHERE id=? AND user_id=?', args: [taskId, userId] });
  const task = taskResult.rows[0];
  if (!task) return res.status(404).json({ error: 'task not found' });
  const maxPosResult = await db.execute({ sql: 'SELECT COALESCE(MAX(position), -1) as m FROM subtasks WHERE task_id=? AND user_id=?', args: [taskId, userId] });
  const maxPos = maxPosResult.rows[0].m;
  const id = `sub-${uid()}`;
  const now = nowISO();
  await db.execute({ sql: 'INSERT INTO subtasks (id, task_id, user_id, title, done, position, created_at) VALUES (?,?,?,?,?,?,?)', args: [id, taskId, userId, title.trim(), 0, maxPos + 1, now] });
  const rowResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE id=?', args: [id] });
  res.status(201).json(mapSubtask(rowResult.rows[0]));
});

app.put('/api/tasks/:taskId/subtasks/:subtaskId', requireAuth, async (req, res) => {
  const userId = req.userId;
  const { subtaskId } = req.params;
  const existingResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE id=? AND user_id=?', args: [subtaskId, userId] });
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'not found' });
  const title = req.body.title !== undefined ? req.body.title : existing.title;
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : existing.done;
  await db.execute({ sql: 'UPDATE subtasks SET title=?, done=? WHERE id=? AND user_id=?', args: [title, done, subtaskId, userId] });
  const rowResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE id=?', args: [subtaskId] });
  res.json(mapSubtask(rowResult.rows[0]));
});

app.delete('/api/tasks/:taskId/subtasks/:subtaskId', requireAuth, async (req, res) => {
  const userId = req.userId;
  const { subtaskId } = req.params;
  const existingResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE id=? AND user_id=?', args: [subtaskId, userId] });
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'not found' });
  await db.execute({ sql: 'DELETE FROM subtasks WHERE id=? AND user_id=?', args: [subtaskId, userId] });
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// DAILY PLANS (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/plans', requireAuth, async (req, res) => {
  const { date } = req.query;
  let rows;
  if (date) {
    const recurringTasksResult = await db.execute({ sql: 'SELECT t.id FROM tasks t JOIN recurrence_rules r ON r.task_id=t.id WHERE t.user_id=? AND t.archived=0 AND r.active=1 AND r.start_date <= ?', args: [req.userId, date] });
    const recurringTasks = recurringTasksResult.rows;
    for (const t of recurringTasks) {
      const existingResult = await db.execute({ sql: 'SELECT id FROM daily_plans WHERE task_id=? AND date=? AND user_id=?', args: [t.id, date, req.userId] });
      const existing = existingResult.rows[0];
      if (!existing) {
        const countResult = await db.execute({ sql: 'SELECT COALESCE(MAX(position), -1) as m FROM daily_plans WHERE date=? AND user_id=?', args: [date, req.userId] });
        const maxPos = countResult.rows[0].m;
        await db.execute({ sql: 'INSERT OR IGNORE INTO daily_plans (id,user_id,task_id,date,position,source_type) VALUES (?,?,?,?,?,?)', args: [`plan-${date}-${t.id}`, req.userId, t.id, date, maxPos + 1, 'recurring'] });
      }
    }
    const rowsResult = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE date=? AND user_id=? ORDER BY position ASC', args: [date, req.userId] });
    rows = rowsResult.rows;
  } else {
    const rowsResult = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE user_id=? ORDER BY date DESC, position ASC', args: [req.userId] });
    rows = rowsResult.rows;
  }
  res.json(rows.map(mapPlan));
});

app.post('/api/plans', requireAuth, async (req, res) => {
  const { taskId, date, position, sourceType = 'normal' } = req.body;
  if (!taskId || !date) return res.status(400).json({ error: 'taskId and date required' });
  const existingResult = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE task_id=? AND date=? AND user_id=?', args: [taskId, date, req.userId] });
  const existing = existingResult.rows[0];
  if (existing) return res.json(mapPlan(existing));
  const maxPosResult = await db.execute({ sql: 'SELECT COALESCE(MAX(position), -1) as m FROM daily_plans WHERE date=? AND user_id=?', args: [date, req.userId] });
  const maxPos = maxPosResult.rows[0].m;
  const id = `plan-${date}-${taskId}`;
  await db.execute({ sql: 'INSERT INTO daily_plans (id,user_id,task_id,date,position,source_type) VALUES (?,?,?,?,?,?)', args: [id, req.userId, taskId, date, position !== undefined ? position : maxPos + 1, sourceType] });
  const rowResult = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE id=? AND user_id=?', args: [id, req.userId] });
  res.status(201).json(mapPlan(rowResult.rows[0]));
});

app.delete('/api/plans/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  await db.execute({ sql: 'DELETE FROM daily_plans WHERE id=? AND user_id=?', args: [id, req.userId] });
  res.json({ ok: true });
});

app.put('/api/plans/reorder', requireAuth, async (req, res) => {
  const { date, orderedTaskIds } = req.body;
  if (!date || !Array.isArray(orderedTaskIds)) return res.status(400).json({ error: 'date and orderedTaskIds required' });
  const statements = orderedTaskIds.map((taskId, idx) => ({ sql: 'UPDATE daily_plans SET position=? WHERE task_id=? AND date=? AND user_id=?', args: [idx, taskId, date, req.userId] }));
  await db.batch(statements, 'WRITE');
  const rowsResult = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE date=? AND user_id=? ORDER BY position ASC', args: [date, req.userId] });
  res.json(rowsResult.rows.map(mapPlan));
});

// ─────────────────────────────────────────
// COMPLETIONS (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/completions', requireAuth, async (req, res) => {
  const { date } = req.query;
  let rows;
  if (date) {
    const result = await db.execute({ sql: 'SELECT * FROM completions WHERE date=? AND user_id=?', args: [date, req.userId] });
    rows = result.rows;
  } else {
    const result = await db.execute({ sql: 'SELECT * FROM completions WHERE user_id=? ORDER BY date DESC', args: [req.userId] });
    rows = result.rows;
  }
  res.json(rows.map(mapCompletion));
});

app.post('/api/completions/toggle', requireAuth, async (req, res) => {
  const { taskId, date } = req.body;
  if (!taskId || !date) return res.status(400).json({ error: 'taskId and date required' });
  const existingResult = await db.execute({ sql: 'SELECT * FROM completions WHERE task_id=? AND date=? AND user_id=?', args: [taskId, date, req.userId] });
  const existing = existingResult.rows[0];
  let isNowCompleted;
  const id = `comp-${date}-${taskId}`;
  if (existing) {
    isNowCompleted = !existing.completed;
    await db.execute({
      sql: 'UPDATE completions SET completed=?,completed_at=? WHERE task_id=? AND date=? AND user_id=?',
      args: [isNowCompleted ? 1 : 0, isNowCompleted ? nowISO() : null, taskId, date, req.userId]
    });
  } else {
    isNowCompleted = true;
    await db.execute({
      sql: 'INSERT INTO completions (id,user_id,task_id,date,completed,completed_at) VALUES (?,?,?,?,?,?)',
      args: [id, req.userId, taskId, date, 1, nowISO()]
    });
  }
  const rowResult = await db.execute({ sql: 'SELECT * FROM completions WHERE task_id=? AND date=? AND user_id=?', args: [taskId, date, req.userId] });
  res.json(mapCompletion(rowResult.rows[0]));
});

// ─────────────────────────────────────────
// STATS & ANALYTICS (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/stats', requireAuth, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  const plansResult = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE date=? AND user_id=?', args: [date, req.userId] });
  const plans = plansResult.rows;
  const plannedCount = plans.length;
  let completedCount = 0;
  const catNames = new Set();
  for (const plan of plans) {
    const compResult = await db.execute({ sql: 'SELECT completed FROM completions WHERE task_id=? AND date=? AND user_id=?', args: [plan.task_id, date, req.userId] });
    const comp = compResult.rows[0];
    if (comp && comp.completed) completedCount++;
    const taskResult = await db.execute({ sql: 'SELECT category_id FROM tasks WHERE id=? AND user_id=?', args: [plan.task_id, req.userId] });
    const task = taskResult.rows[0];
    if (task) {
      const catResult = await db.execute({ sql: 'SELECT name FROM categories WHERE id=? AND user_id=?', args: [task.category_id, req.userId] });
      const cat = catResult.rows[0];
      if (cat) catNames.add(cat.name);
    }
  }
  const percentage = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;
  res.json({ date, plannedCount, completedCount, percentage, categoriesRepresented: [...catNames] });
});

app.get('/api/stats/streak', requireAuth, async (req, res) => {
  const today = new Date();
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  let totalCompleted = 0;
  let totalPct = 0;
  let activeDays = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const plannedResult = await db.execute({ sql: 'SELECT COUNT(*) as c FROM daily_plans WHERE date=? AND user_id=?', args: [dateStr, req.userId] });
    const planned = Number(plannedResult.rows[0]?.c || 0);
    const compResult = await db.execute({ sql: 'SELECT COUNT(*) as c FROM completions WHERE date=? AND user_id=? AND completed=1', args: [dateStr, req.userId] });
    const completed = Number(compResult.rows[0]?.c || 0);
    if (planned > 0 && completed > 0) {
      tempStreak++;
      if (i === 0 || currentStreak === i) currentStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else if (planned > 0) {
      tempStreak = 0;
    }
    if (i < 60 && planned > 0) {
      totalPct += Math.round((completed / planned) * 100);
      activeDays++;
    }
    if (i < 365) totalCompleted += completed;
  }

  res.json({
    currentStreak,
    bestStreak,
    totalCompletedTasks: totalCompleted,
    avgCompletionRate: activeDays > 0 ? Math.round(totalPct / activeDays) : 0,
  });
});

app.get('/api/stats/heatmap', requireAuth, async (req, res) => {
  const { startDate, endDate, days } = req.query;

  if (startDate && endDate) {
    const result = [];
    const curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const plannedResult = await db.execute({ sql: 'SELECT COUNT(*) as c FROM daily_plans WHERE date=? AND user_id=?', args: [dateStr, req.userId] });
      const planned = Number(plannedResult.rows[0]?.c || 0);
      const compResult = await db.execute({ sql: 'SELECT COUNT(*) as c FROM completions WHERE date=? AND user_id=? AND completed=1', args: [dateStr, req.userId] });
      const completed = Number(compResult.rows[0]?.c || 0);
      const percentage = planned > 0 ? Math.round((completed / planned) * 100) : 0;
      result.push({ date: dateStr, plannedCount: planned, completedCount: completed, percentage });
      curr.setDate(curr.getDate() + 1);
    }
    return res.json(result);
  }

  const daysCount = parseInt(days || '364', 10);
  const result = [];
  const today = new Date();
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const plannedResult = await db.execute({ sql: 'SELECT COUNT(*) as c FROM daily_plans WHERE date=? AND user_id=?', args: [dateStr, req.userId] });
    const planned = Number(plannedResult.rows[0]?.c || 0);
    const compResult = await db.execute({ sql: 'SELECT COUNT(*) as c FROM completions WHERE date=? AND user_id=? AND completed=1', args: [dateStr, req.userId] });
    const completed = Number(compResult.rows[0]?.c || 0);
    const percentage = planned > 0 ? Math.round((completed / planned) * 100) : 0;
    result.push({ date: dateStr, plannedCount: planned, completedCount: completed, percentage });
  }
  res.json(result);
});

app.get('/api/stats/account-start', requireAuth, async (req, res) => {
  const taskRes = await db.execute({ sql: 'SELECT MIN(created_at) as m FROM tasks WHERE user_id=?', args: [req.userId] });
  const catRes = await db.execute({ sql: 'SELECT MIN(created_at) as m FROM categories WHERE user_id=?', args: [req.userId] });
  const planRes = await db.execute({ sql: 'SELECT MIN(date) as m FROM daily_plans WHERE user_id=?', args: [req.userId] });
  const compRes = await db.execute({ sql: 'SELECT MIN(date) as m FROM completions WHERE user_id=?', args: [req.userId] });

  const earliestTask = taskRes.rows[0]?.m;
  const earliestCat = catRes.rows[0]?.m;
  const earliestPlan = planRes.rows[0]?.m;
  const earliestComp = compRes.rows[0]?.m;

  let earliest = [earliestTask, earliestCat, earliestPlan, earliestComp]
    .filter(Boolean)
    .map(d => String(d).split('T')[0])
    .sort()[0];

  if (!earliest) {
    earliest = new Date().toISOString().split('T')[0];
  }

  res.json({ startDate: earliest });
});

// ─────────────────────────────────────────
// EXPORT / IMPORT / RESET (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/export', requireAuth, async (req, res) => {
  const catsRes = await db.execute({ sql: 'SELECT * FROM categories WHERE user_id=?', args: [req.userId] });
  const tasksRes = await db.execute({ sql: 'SELECT * FROM tasks WHERE user_id=?', args: [req.userId] });
  const plansRes = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE user_id=?', args: [req.userId] });
  const compRes = await db.execute({ sql: 'SELECT * FROM completions WHERE user_id=?', args: [req.userId] });

  const tasksWithRec = [];
  for (const t of tasksRes.rows) {
    const recRes = await db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [t.id, req.userId] });
    tasksWithRec.push(mapTask(t, recRes.rows[0]));
  }

  const data = {
    categories: catsRes.rows.map(mapCategory),
    tasks: tasksWithRec,
    dailyPlans: plansRes.rows.map(mapPlan),
    completions: compRes.rows.map(mapCompletion),
    exportedAt: nowISO(),
  };
  res.setHeader('Content-Disposition', `attachment; filename=bromise_backup_${new Date().toISOString().split('T')[0]}.json`);
  res.json(data);
});

app.post('/api/import', requireAuth, async (req, res) => {
  const { categories, tasks, dailyPlans, completions } = req.body;
  if (!categories || !tasks) return res.status(400).json({ error: 'Invalid backup file' });

  try {
    await db.execute({ sql: 'DELETE FROM completions WHERE user_id=?', args: [req.userId] });
    await db.execute({ sql: 'DELETE FROM daily_plans WHERE user_id=?', args: [req.userId] });
    await db.execute({ sql: 'DELETE FROM recurrence_rules WHERE user_id=?', args: [req.userId] });
    await db.execute({ sql: 'DELETE FROM tasks WHERE user_id=?', args: [req.userId] });
    await db.execute({ sql: 'DELETE FROM categories WHERE user_id=?', args: [req.userId] });

    for (const c of categories) {
      await db.execute({
        sql: 'INSERT INTO categories (id,user_id,name,icon,accent,position,created_at,updated_at,archived) VALUES (?,?,?,?,?,?,?,?,?)',
        args: [c.id, req.userId, c.name, c.icon, c.accent, c.position, c.createdAt, c.updatedAt || c.createdAt, 0]
      });
    }
    for (const t of tasks) {
      await db.execute({
        sql: 'INSERT INTO tasks (id,user_id,category_id,title,notes,priority,deadline,is_recurring,created_at,updated_at,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        args: [t.id, req.userId, t.categoryId, t.title, t.notes || null, t.priority, t.deadline || null, t.isRecurring ? 1 : 0, t.createdAt, t.updatedAt, 0]
      });
      if (t.recurrenceRule) {
        const rr = t.recurrenceRule;
        await db.execute({
          sql: 'INSERT OR IGNORE INTO recurrence_rules (id,user_id,task_id,frequency,start_date,end_date,active) VALUES (?,?,?,?,?,?,?)',
          args: [rr.id, req.userId, t.id, rr.frequency || 'daily', rr.startDate, rr.endDate || null, rr.active !== false ? 1 : 0]
        });
      }
    }
    for (const p of (dailyPlans || [])) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO daily_plans (id,user_id,task_id,date,position,source_type) VALUES (?,?,?,?,?,?)',
        args: [p.id, req.userId, p.taskId, p.date, p.position, p.sourceType || 'normal']
      });
    }
    for (const c of (completions || [])) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO completions (id,user_id,task_id,date,completed,completed_at) VALUES (?,?,?,?,?,?)',
        args: [c.id, req.userId, c.taskId, c.date, c.completed ? 1 : 0, c.completedAt || null]
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/seed/reset', requireAuth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM completions WHERE user_id=?', args: [req.userId] });
  await db.execute({ sql: 'DELETE FROM daily_plans WHERE user_id=?', args: [req.userId] });
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// SERVE VITE PRODUCTION BUILD
// ─────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`BROMISE server running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
});
