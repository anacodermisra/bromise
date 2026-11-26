'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const db = require('./db');
const { verifyGoogleTokenAndGetUser, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

// CORS Configuration — allow Vercel deployments, configured custom origins, Capacitor mobile, and localhost
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || !IS_PROD) return callback(null, true);
    const allowed = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    if (
      allowed.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('https://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.startsWith('capacitor://')
    ) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Set Content Security Policy headers for Google OAuth and resources
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "frame-src 'self' https://accounts.google.com; " +
    "connect-src 'self' https://accounts.google.com https://*.turso.io https://*.onrender.com https:; " +
    "img-src 'self' data: blob: http: https:;"
  );
  next();
});

// Ensure database schema & indexes are ready on every cold start before hitting routes
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next();
  try {
    await db.ensureReady();
    next();
  } catch (err) {
    console.error('Database readiness error:', err);
    res.status(503).json({ error: 'Database unavailable: ' + (err?.message || 'initialization failed') });
  }
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function nowISO() { return new Date().toISOString(); }
function uid() { return randomUUID(); }

const ALLOWED_ID_TABLES = new Set([
  'categories',
  'tasks',
  'recurrence_rules',
  'daily_plans',
  'completions',
  'subtasks',
]);

/**
 * Resolve an incoming client ID safely so another user's primary key is never
 * overwritten or collided with, while keeping retries by the same user idempotent.
 */
async function resolveScopedId(table, userId, requestedId, prefix) {
  if (!ALLOWED_ID_TABLES.has(table)) {
    throw new Error(`Unsupported table: ${table}`);
  }
  if (!requestedId || typeof requestedId !== 'string') {
    return `${prefix}-${uid()}`;
  }
  const existing = await db.execute({
    sql: `SELECT user_id FROM ${table} WHERE id = ?`,
    args: [requestedId],
  });
  if (!existing.rows[0] || existing.rows[0].user_id === userId) {
    return requestedId;
  }
  return `${prefix}-${uid()}`;
}

/**
 * Query which IDs from a list are already owned by a different user_id.
 */
async function findOtherUserOwnedIds(table, ids, userId) {
  if (!ALLOWED_ID_TABLES.has(table) || !Array.isArray(ids) || ids.length === 0) {
    return new Set();
  }
  const uniqueIds = Array.from(new Set(ids.filter(id => typeof id === 'string' && id.length > 0)));
  const conflictSet = new Set();
  const CHUNK = 150;
  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    const chunk = uniqueIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    const res = await db.execute({
      sql: `SELECT id FROM ${table} WHERE user_id != ? AND id IN (${placeholders})`,
      args: [userId, ...chunk],
    });
    for (const row of res.rows) {
      conflictSet.add(row.id);
    }
  }
  return conflictSet;
}

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
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : undefined,
    timeSlot: row.start_time || undefined,
    completed: row.completed !== undefined && row.completed !== null ? !!row.completed : undefined,
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
app.get('/api/health', async (_req, res) => {
  try {
    await db.ensureReady();
    res.json({
      status: 'ok',
      dbPersistent: db.isPersistentCloudDb(),
      timestamp: nowISO(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      dbPersistent: db.isPersistentCloudDb(),
      error: err?.message || 'Database health check failed',
      timestamp: nowISO(),
    });
  }
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
  const userResult = await db.execute({
    sql: 'SELECT id, email, name, picture, created_at FROM users WHERE id = ?',
    args: [req.userId],
  });
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ─────────────────────────────────────────
// CATEGORIES (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/categories', requireAuth, async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM categories WHERE user_id = ? AND archived = 0 ORDER BY position ASC',
    args: [req.userId],
  });
  res.json(result.rows.map(mapCategory));
});

app.post('/api/categories', requireAuth, async (req, res) => {
  const { name, icon = 'Sparkles', accent = '#8b5cf6' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = await resolveScopedId('categories', req.userId, req.body.id, 'cat');
  const existingSelf = await db.execute({
    sql: 'SELECT * FROM categories WHERE id=? AND user_id=?',
    args: [id, req.userId],
  });
  if (existingSelf.rows[0]) {
    return res.status(200).json(mapCategory(existingSelf.rows[0]));
  }

  const maxPosResult = await db.execute({
    sql: 'SELECT COALESCE(MAX(position), -1) as m FROM categories WHERE user_id = ?',
    args: [req.userId],
  });
  const maxPos = Number(maxPosResult.rows[0].m);
  const now = nowISO();
  await db.execute({
    sql: 'INSERT INTO categories (id,user_id,name,icon,accent,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
    args: [id, req.userId, name, icon, accent, maxPos + 1, now, now],
  });
  const rowResult = await db.execute({
    sql: 'SELECT * FROM categories WHERE id=? AND user_id=?',
    args: [id, req.userId],
  });
  res.status(201).json(mapCategory(rowResult.rows[0]));
});

app.put('/api/categories/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const existingResult = await db.execute({
    sql: 'SELECT * FROM categories WHERE id=? AND user_id=?',
    args: [id, req.userId],
  });
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'not found' });
  const now = nowISO();
  const name = req.body.name ?? existing.name;
  const icon = req.body.icon ?? existing.icon;
  const accent = req.body.accent ?? existing.accent;
  const position = req.body.position ?? existing.position;
  await db.execute({
    sql: 'UPDATE categories SET name=?,icon=?,accent=?,position=?,updated_at=? WHERE id=? AND user_id=?',
    args: [name, icon, accent, position, now, id, req.userId],
  });
  const rowResult = await db.execute({
    sql: 'SELECT * FROM categories WHERE id=? AND user_id=?',
    args: [id, req.userId],
  });
  res.json(mapCategory(rowResult.rows[0]));
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { action = 'delete', targetCategoryId } = req.body || {};
    const checkResult = await db.execute({
      sql: 'SELECT id FROM categories WHERE id=? AND user_id=?',
      args: [id, req.userId],
    });
    if (!checkResult.rows[0]) {
      return res.status(404).json({ error: 'not found' });
    }

    const statements = [];

    if (action === 'move' && targetCategoryId) {
      statements.push({
        sql: 'UPDATE tasks SET category_id=?, updated_at=? WHERE category_id=? AND user_id=?',
        args: [targetCategoryId, nowISO(), id, req.userId],
      });
    } else {
      const tasksResult = await db.execute({
        sql: 'SELECT id FROM tasks WHERE category_id=? AND user_id=?',
        args: [id, req.userId],
      });
      for (const t of tasksResult.rows) {
        statements.push({ sql: 'DELETE FROM subtasks WHERE task_id=? AND user_id=?', args: [t.id, req.userId] });
        statements.push({ sql: 'DELETE FROM daily_plans WHERE task_id=? AND user_id=?', args: [t.id, req.userId] });
        statements.push({ sql: 'DELETE FROM completions WHERE task_id=? AND user_id=?', args: [t.id, req.userId] });
        statements.push({ sql: 'DELETE FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [t.id, req.userId] });
      }
      statements.push({ sql: 'DELETE FROM tasks WHERE category_id=? AND user_id=?', args: [id, req.userId] });
    }

    statements.push({ sql: 'DELETE FROM categories WHERE id=? AND user_id=?', args: [id, req.userId] });

    await db.batch(statements, 'write');
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ─────────────────────────────────────────
// TASKS (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const [tasksResult, recResult, subtasksResult] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM tasks WHERE user_id=? ORDER BY created_at ASC', args: [req.userId] }),
      db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE user_id=?', args: [req.userId] }),
      db.execute({ sql: 'SELECT * FROM subtasks WHERE user_id=? ORDER BY position ASC', args: [req.userId] }),
    ]);

    const recMap = new Map();
    for (const r of recResult.rows) {
      recMap.set(r.task_id, r);
    }

    const subtasksMap = new Map();
    for (const s of subtasksResult.rows) {
      if (!subtasksMap.has(s.task_id)) {
        subtasksMap.set(s.task_id, []);
      }
      subtasksMap.get(s.task_id).push(mapSubtask(s));
    }

    const result = tasksResult.rows.map(t => {
      const mapped = mapTask(t, recMap.get(t.id));
      mapped.subtasks = subtasksMap.get(t.id) || [];
      return mapped;
    });

    res.json(result);
  } catch (err) {
    console.error('Failed to get tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  const { title, categoryId, notes, priority = 'medium', deadline, isRecurring = false, recurrenceRule, subtasks } = req.body;
  if (!title || !categoryId) return res.status(400).json({ error: 'title and categoryId required' });

  const id = await resolveScopedId('tasks', req.userId, req.body.id, 'task');
  const existingSelf = await db.execute({
    sql: 'SELECT * FROM tasks WHERE id=? AND user_id=?',
    args: [id, req.userId],
  });
  if (existingSelf.rows[0]) {
    const recRes = await db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [id, req.userId] });
    const mapped = mapTask(existingSelf.rows[0], recRes.rows[0]);
    const subsRes = await db.execute({ sql: 'SELECT * FROM subtasks WHERE task_id=? AND user_id=? ORDER BY position ASC', args: [id, req.userId] });
    mapped.subtasks = subsRes.rows.map(mapSubtask);
    return res.status(200).json(mapped);
  }

  const now = nowISO();
  await db.execute({
    sql: 'INSERT INTO tasks (id,user_id,category_id,title,notes,priority,deadline,is_recurring,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    args: [id, req.userId, categoryId, title, notes || null, priority, deadline || null, isRecurring ? 1 : 0, now, now],
  });

  let rec = null;
  if (isRecurring) {
    const recId = await resolveScopedId('recurrence_rules', req.userId, recurrenceRule?.id, 'rec');
    const startDate = (recurrenceRule && recurrenceRule.startDate) || now.split('T')[0];
    await db.execute({
      sql: 'INSERT INTO recurrence_rules (id,user_id,task_id,frequency,start_date,active) VALUES (?,?,?,?,?,?)',
      args: [recId, req.userId, id, 'daily', startDate, 1],
    });
    const recResult = await db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [id, req.userId] });
    rec = recResult.rows[0];
  }

  const createdSubtasks = [];
  if (Array.isArray(subtasks) && subtasks.length > 0) {
    for (let i = 0; i < subtasks.length; i++) {
      const sub = subtasks[i];
      if (!sub || !sub.title) continue;
      const subId = await resolveScopedId('subtasks', req.userId, sub.id, 'sub');
      await db.execute({
        sql: 'INSERT OR IGNORE INTO subtasks (id, task_id, user_id, title, done, position, created_at) VALUES (?,?,?,?,?,?,?)',
        args: [subId, id, req.userId, String(sub.title).trim(), sub.done ? 1 : 0, Number.isInteger(sub.position) ? sub.position : i, sub.createdAt || now],
      });
    }
    const subsRes = await db.execute({ sql: 'SELECT * FROM subtasks WHERE task_id=? AND user_id=? ORDER BY position ASC', args: [id, req.userId] });
    createdSubtasks.push(...subsRes.rows.map(mapSubtask));
  }

  const taskResult = await db.execute({ sql: 'SELECT * FROM tasks WHERE id=? AND user_id=?', args: [id, req.userId] });
  const mapped = mapTask(taskResult.rows[0], rec);
  mapped.subtasks = createdSubtasks;
  res.status(201).json(mapped);
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
  await db.execute({
    sql: 'UPDATE tasks SET category_id=?,title=?,notes=?,priority=?,deadline=?,is_recurring=?,updated_at=? WHERE id=? AND user_id=?',
    args: [categoryId, title, notes || null, priority, deadline || null, isRecurring, now, id, req.userId],
  });
  if (req.body.recurrenceRule && isRecurring) {
    const rr = req.body.recurrenceRule;
    const existingRecResult = await db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE task_id=? AND user_id=?', args: [id, req.userId] });
    const existing_rec = existingRecResult.rows[0];
    if (existing_rec) {
      await db.execute({
        sql: 'UPDATE recurrence_rules SET frequency=?,start_date=?,end_date=?,active=? WHERE task_id=? AND user_id=?',
        args: [rr.frequency || 'daily', rr.startDate || existing_rec.start_date, rr.endDate || null, rr.active !== false ? 1 : 0, id, req.userId],
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO recurrence_rules (id,user_id,task_id,frequency,start_date,active) VALUES (?,?,?,?,?,?)',
        args: [`rec-${uid()}`, req.userId, id, rr.frequency || 'daily', rr.startDate || now.split('T')[0], 1],
      });
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
  const today = req.body?.date || new Date().toISOString().split('T')[0];
  await db.execute({ sql: 'DELETE FROM daily_plans WHERE task_id=? AND user_id=? AND date > ?', args: [id, req.userId, today] });
  await db.execute({ sql: 'UPDATE tasks SET archived=1, updated_at=? WHERE id=? AND user_id=?', args: [nowISO(), id, req.userId] });
  res.json({ ok: true });
});

app.post('/api/tasks/:id/finish', requireAuth, async (req, res) => {
  const { id } = req.params;
  const taskCheck = await db.execute({ sql: 'SELECT id FROM tasks WHERE id=? AND user_id=?', args: [id, req.userId] });
  if (!taskCheck.rows[0]) {
    return res.status(404).json({ error: 'not found' });
  }
  const { date = new Date().toISOString().split('T')[0] } = req.body || {};
  const now = nowISO();

  await db.execute({ sql: 'UPDATE tasks SET archived=1, updated_at=? WHERE id=? AND user_id=?', args: [now, id, req.userId] });

  const existingComp = await db.execute({
    sql: 'SELECT id FROM completions WHERE task_id=? AND date=? AND user_id=?',
    args: [id, date, req.userId],
  });
  if (existingComp.rows[0]) {
    await db.execute({
      sql: 'UPDATE completions SET completed=1, completed_at=? WHERE id=? AND user_id=?',
      args: [now, existingComp.rows[0].id, req.userId],
    });
  } else {
    const compId = `comp-${req.userId}-${date}-${id}`;
    await db.execute({
      sql: 'INSERT OR IGNORE INTO completions (id, user_id, task_id, date, completed, completed_at) VALUES (?, ?, ?, ?, 1, ?)',
      args: [compId, req.userId, id, date, now],
    });
  }

  await db.execute({ sql: 'DELETE FROM daily_plans WHERE task_id=? AND user_id=? AND date > ?', args: [id, req.userId, date] });
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// SUBTASKS
// ─────────────────────────────────────────
app.get('/api/tasks/:taskId/subtasks', requireAuth, async (req, res) => {
  const userId = req.userId;
  const { taskId } = req.params;
  const rowsResult = await db.execute({
    sql: 'SELECT * FROM subtasks WHERE task_id=? AND user_id=? ORDER BY position ASC',
    args: [taskId, userId],
  });
  res.json(rowsResult.rows.map(mapSubtask));
});

app.post('/api/tasks/:taskId/subtasks', requireAuth, async (req, res) => {
  const userId = req.userId;
  const { taskId } = req.params;
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
  const taskResult = await db.execute({ sql: 'SELECT id FROM tasks WHERE id=? AND user_id=?', args: [taskId, userId] });
  if (!taskResult.rows[0]) return res.status(404).json({ error: 'task not found' });
  const maxPosResult = await db.execute({
    sql: 'SELECT COALESCE(MAX(position), -1) as m FROM subtasks WHERE task_id=? AND user_id=?',
    args: [taskId, userId],
  });
  const maxPos = Number(maxPosResult.rows[0].m);
  const id = `sub-${uid()}`;
  const now = nowISO();
  await db.execute({
    sql: 'INSERT INTO subtasks (id, task_id, user_id, title, done, position, created_at) VALUES (?,?,?,?,?,?,?)',
    args: [id, taskId, userId, title.trim(), 0, maxPos + 1, now],
  });
  const rowResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE id=? AND user_id=?', args: [id, userId] });
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
  const rowResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE id=? AND user_id=?', args: [subtaskId, userId] });
  res.json(mapSubtask(rowResult.rows[0]));
});

app.delete('/api/tasks/:taskId/subtasks/:subtaskId', requireAuth, async (req, res) => {
  const userId = req.userId;
  const { subtaskId } = req.params;
  const existingResult = await db.execute({ sql: 'SELECT * FROM subtasks WHERE id=? AND user_id=?', args: [subtaskId, userId] });
  if (!existingResult.rows[0]) return res.status(404).json({ error: 'not found' });
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
    const recurringTasksResult = await db.execute({
      sql: 'SELECT t.id FROM tasks t JOIN recurrence_rules r ON r.task_id=t.id WHERE t.user_id=? AND t.archived=0 AND r.active=1 AND r.start_date <= ?',
      args: [req.userId, date],
    });
    const recurringTasks = recurringTasksResult.rows;
    for (const t of recurringTasks) {
      const existingResult = await db.execute({
        sql: 'SELECT id FROM daily_plans WHERE task_id=? AND date=? AND user_id=?',
        args: [t.id, date, req.userId],
      });
      if (!existingResult.rows[0]) {
        const countResult = await db.execute({
          sql: 'SELECT COALESCE(MAX(position), -1) as m FROM daily_plans WHERE date=? AND user_id=?',
          args: [date, req.userId],
        });
        const maxPos = Number(countResult.rows[0].m);
        await db.execute({
          sql: 'INSERT OR IGNORE INTO daily_plans (id,user_id,task_id,date,position,source_type) VALUES (?,?,?,?,?,?)',
          args: [`plan-${req.userId}-${date}-${t.id}`, req.userId, t.id, date, maxPos + 1, 'recurring'],
        });
      }
    }
    const rowsResult = await db.execute({
      sql: 'SELECT * FROM daily_plans WHERE date=? AND user_id=? ORDER BY position ASC',
      args: [date, req.userId],
    });
    rows = rowsResult.rows;
  } else {
    const rowsResult = await db.execute({
      sql: 'SELECT * FROM daily_plans WHERE user_id=? ORDER BY date DESC, position ASC',
      args: [req.userId],
    });
    rows = rowsResult.rows;
  }
  res.json(rows.map(mapPlan));
});

app.post('/api/plans', requireAuth, async (req, res) => {
  const {
    id: clientPlanId,
    taskId,
    date,
    position,
    sourceType = 'normal',
    startTime,
    endTime,
    durationMinutes,
    timeSlot,
    completed,
  } = req.body;
  if (!taskId || !date) return res.status(400).json({ error: 'taskId and date required' });

  const sTime = startTime || timeSlot || null;
  const dur = durationMinutes || (sTime ? 60 : null);
  const isComp = completed ? 1 : 0;

  if (clientPlanId) {
    const existingById = await db.execute({
      sql: 'SELECT * FROM daily_plans WHERE id=? AND user_id=?',
      args: [clientPlanId, req.userId],
    });
    if (existingById.rows[0]) {
      await db.execute({
        sql: 'UPDATE daily_plans SET start_time=?, end_time=?, duration_minutes=?, completed=? WHERE id=? AND user_id=?',
        args: [sTime, endTime || null, dur, isComp, clientPlanId, req.userId],
      });
      const updated = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE id=? AND user_id=?', args: [clientPlanId, req.userId] });
      return res.json(mapPlan(updated.rows[0]));
    }
  }

  if (!sTime) {
    const existingResult = await db.execute({
      sql: "SELECT * FROM daily_plans WHERE task_id=? AND date=? AND user_id=? AND (start_time IS NULL OR start_time = '')",
      args: [taskId, date, req.userId],
    });
    if (existingResult.rows[0]) return res.json(mapPlan(existingResult.rows[0]));
  }

  const maxPosResult = await db.execute({
    sql: 'SELECT COALESCE(MAX(position), -1) as m FROM daily_plans WHERE date=? AND user_id=?',
    args: [date, req.userId],
  });
  const maxPos = Number(maxPosResult.rows[0].m);
  const defaultPrefix = sTime ? `slot-${req.userId}-${date}` : `plan-${req.userId}-${date}`;
  const id = await resolveScopedId('daily_plans', req.userId, clientPlanId, defaultPrefix);

  await db.execute({
    sql: 'INSERT INTO daily_plans (id,user_id,task_id,date,position,source_type,start_time,end_time,duration_minutes,completed) VALUES (?,?,?,?,?,?,?,?,?,?)',
    args: [id, req.userId, taskId, date, position !== undefined ? position : maxPos + 1, sourceType, sTime, endTime || null, dur, isComp],
  });
  const rowResult = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE id=? AND user_id=?', args: [id, req.userId] });
  res.status(201).json(mapPlan(rowResult.rows[0]));
});

app.put('/api/plans/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime, durationMinutes, timeSlot, completed } = req.body;
  const sTime = startTime !== undefined ? startTime : timeSlot;

  const sets = [];
  const args = [];

  if (sTime !== undefined) {
    sets.push('start_time=?');
    args.push(sTime || null);
  }
  if (endTime !== undefined) {
    sets.push('end_time=?');
    args.push(endTime || null);
  }
  if (durationMinutes !== undefined) {
    sets.push('duration_minutes=?');
    args.push(durationMinutes);
  }
  if (completed !== undefined) {
    sets.push('completed=?');
    args.push(completed ? 1 : 0);
  }

  if (sets.length > 0) {
    args.push(id, req.userId);
    await db.execute({
      sql: `UPDATE daily_plans SET ${sets.join(', ')} WHERE id=? AND user_id=?`,
      args,
    });
  }

  const rowResult = await db.execute({ sql: 'SELECT * FROM daily_plans WHERE id=? AND user_id=?', args: [id, req.userId] });
  if (rowResult.rows[0]) {
    res.json(mapPlan(rowResult.rows[0]));
  } else {
    res.json({ ok: true, notFound: true, id });
  }
});

app.delete('/api/plans/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  await db.execute({ sql: 'DELETE FROM daily_plans WHERE id=? AND user_id=?', args: [id, req.userId] });
  res.json({ ok: true });
});

app.put('/api/plans/reorder', requireAuth, async (req, res) => {
  const { date, orderedTaskIds } = req.body;
  if (!date || !Array.isArray(orderedTaskIds)) return res.status(400).json({ error: 'date and orderedTaskIds required' });

  const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
  for (const taskId of orderedTaskIds) {
    if (typeof taskId !== 'string' || !idPattern.test(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }
  }

  const statements = orderedTaskIds.map((taskId, idx) => ({
    sql: 'UPDATE daily_plans SET position=? WHERE task_id=? AND date=? AND user_id=?',
    args: [idx, taskId, date, req.userId],
  }));
  if (statements.length > 0) {
    await db.batch(statements, 'write');
  }
  const rowsResult = await db.execute({
    sql: 'SELECT * FROM daily_plans WHERE date=? AND user_id=? ORDER BY position ASC',
    args: [date, req.userId],
  });
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
  const existingResult = await db.execute({
    sql: 'SELECT * FROM completions WHERE task_id=? AND date=? AND user_id=?',
    args: [taskId, date, req.userId],
  });
  const existing = existingResult.rows[0];
  let isNowCompleted;
  if (existing) {
    isNowCompleted = !existing.completed;
    await db.execute({
      sql: 'UPDATE completions SET completed=?,completed_at=? WHERE id=? AND user_id=?',
      args: [isNowCompleted ? 1 : 0, isNowCompleted ? nowISO() : null, existing.id, req.userId],
    });
  } else {
    const id = `comp-${req.userId}-${date}-${taskId}`;
    await db.execute({
      sql: 'INSERT INTO completions (id,user_id,task_id,date,completed,completed_at) VALUES (?,?,?,?,?,?)',
      args: [id, req.userId, taskId, date, 1, nowISO()],
    });
  }
  const rowResult = await db.execute({
    sql: 'SELECT * FROM completions WHERE task_id=? AND date=? AND user_id=?',
    args: [taskId, date, req.userId],
  });
  res.json(mapCompletion(rowResult.rows[0]));
});

// ─────────────────────────────────────────
// STATS & ANALYTICS (USER PROTECTED — BATCHED SQL)
// ─────────────────────────────────────────
app.get('/api/stats', requireAuth, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  const [plansRes, compsRes, tasksRes, catsRes] = await Promise.all([
    db.execute({ sql: 'SELECT task_id, completed FROM daily_plans WHERE date=? AND user_id=?', args: [date, req.userId] }),
    db.execute({ sql: 'SELECT task_id, completed FROM completions WHERE date=? AND user_id=?', args: [date, req.userId] }),
    db.execute({ sql: 'SELECT id, category_id FROM tasks WHERE user_id=?', args: [req.userId] }),
    db.execute({ sql: 'SELECT id, name FROM categories WHERE user_id=?', args: [req.userId] }),
  ]);

  const catNameById = new Map(catsRes.rows.map(c => [c.id, c.name]));
  const taskCatById = new Map(tasksRes.rows.map(t => [t.id, t.category_id]));
  const compByTask = new Map(compsRes.rows.map(c => [c.task_id, !!c.completed]));

  const slotsByTask = new Map();
  for (const row of plansRes.rows) {
    if (!slotsByTask.has(row.task_id)) slotsByTask.set(row.task_id, []);
    slotsByTask.get(row.task_id).push(row.completed === 1);
  }

  const plannedCount = slotsByTask.size;
  let completedCount = 0;
  const catNames = new Set();

  for (const [taskId, slots] of slotsByTask.entries()) {
    const allSlotsCompleted = slots.length > 0 && slots.every(Boolean);
    if (compByTask.get(taskId) || allSlotsCompleted) {
      completedCount++;
    }
    const catId = taskCatById.get(taskId);
    const catName = catId ? catNameById.get(catId) : null;
    if (catName) catNames.add(catName);
  }

  const percentage = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;
  res.json({ date, plannedCount, completedCount, percentage, categoriesRepresented: [...catNames] });
});

app.get('/api/stats/streak', requireAuth, async (req, res) => {
  const today = new Date();
  const maxDateStr = today.toISOString().split('T')[0];
  const minD = new Date(today);
  minD.setDate(minD.getDate() - 364);
  const minDateStr = minD.toISOString().split('T')[0];

  const [plansAgg, compsAgg] = await Promise.all([
    db.execute({
      sql: 'SELECT date, COUNT(DISTINCT task_id) as c FROM daily_plans WHERE user_id=? AND date>=? AND date<=? GROUP BY date',
      args: [req.userId, minDateStr, maxDateStr],
    }),
    db.execute({
      sql: 'SELECT date, COUNT(*) as c FROM completions WHERE user_id=? AND completed=1 AND date>=? AND date<=? GROUP BY date',
      args: [req.userId, minDateStr, maxDateStr],
    }),
  ]);

  const plannedMap = new Map(plansAgg.rows.map(r => [r.date, Number(r.c || 0)]));
  const compMap = new Map(compsAgg.rows.map(r => [r.date, Number(r.c || 0)]));

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
    const planned = plannedMap.get(dateStr) || 0;
    const completed = compMap.get(dateStr) || 0;

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
    totalCompleted += completed;
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
  const today = new Date();
  let startD;
  let endD;

  if (startDate && endDate) {
    startD = new Date(startDate);
    endD = new Date(endDate);
  } else {
    const daysCount = Math.min(730, Math.max(1, parseInt(days || '364', 10)));
    endD = today;
    startD = new Date(today);
    startD.setDate(today.getDate() - (daysCount - 1));
  }

  const startStr = startD.toISOString().split('T')[0];
  const endStr = endD.toISOString().split('T')[0];

  const [plansAgg, compsAgg] = await Promise.all([
    db.execute({
      sql: 'SELECT date, COUNT(DISTINCT task_id) as c FROM daily_plans WHERE user_id=? AND date>=? AND date<=? GROUP BY date',
      args: [req.userId, startStr, endStr],
    }),
    db.execute({
      sql: 'SELECT date, COUNT(*) as c FROM completions WHERE user_id=? AND completed=1 AND date>=? AND date<=? GROUP BY date',
      args: [req.userId, startStr, endStr],
    }),
  ]);

  const plannedMap = new Map(plansAgg.rows.map(r => [r.date, Number(r.c || 0)]));
  const compMap = new Map(compsAgg.rows.map(r => [r.date, Number(r.c || 0)]));

  const result = [];
  const curr = new Date(startD);
  while (curr <= endD) {
    const dateStr = curr.toISOString().split('T')[0];
    const planned = plannedMap.get(dateStr) || 0;
    const completed = compMap.get(dateStr) || 0;
    const percentage = planned > 0 ? Math.round((completed / planned) * 100) : 0;
    result.push({ date: dateStr, plannedCount: planned, completedCount: completed, percentage });
    curr.setDate(curr.getDate() + 1);
  }
  res.json(result);
});

app.get('/api/stats/account-start', requireAuth, async (req, res) => {
  const [taskRes, catRes, planRes, compRes] = await Promise.all([
    db.execute({ sql: 'SELECT MIN(created_at) as m FROM tasks WHERE user_id=?', args: [req.userId] }),
    db.execute({ sql: 'SELECT MIN(created_at) as m FROM categories WHERE user_id=?', args: [req.userId] }),
    db.execute({ sql: 'SELECT MIN(date) as m FROM daily_plans WHERE user_id=?', args: [req.userId] }),
    db.execute({ sql: 'SELECT MIN(date) as m FROM completions WHERE user_id=?', args: [req.userId] }),
  ]);

  let earliest = [taskRes.rows[0]?.m, catRes.rows[0]?.m, planRes.rows[0]?.m, compRes.rows[0]?.m]
    .filter(Boolean)
    .map(d => String(d).split('T')[0])
    .sort()[0];

  if (!earliest) {
    earliest = new Date().toISOString().split('T')[0];
  }

  res.json({ startDate: earliest });
});

// ─────────────────────────────────────────
// EXPORT / IMPORT / MERGE / RESET (USER PROTECTED)
// ─────────────────────────────────────────
app.get('/api/export', requireAuth, async (req, res) => {
  try {
    const [catsRes, tasksRes, recRes, subtasksRes, plansRes, compRes, settingsRes] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM categories WHERE user_id=?', args: [req.userId] }),
      db.execute({ sql: 'SELECT * FROM tasks WHERE user_id=?', args: [req.userId] }),
      db.execute({ sql: 'SELECT * FROM recurrence_rules WHERE user_id=?', args: [req.userId] }),
      db.execute({ sql: 'SELECT * FROM subtasks WHERE user_id=? ORDER BY position ASC', args: [req.userId] }),
      db.execute({ sql: 'SELECT * FROM daily_plans WHERE user_id=?', args: [req.userId] }),
      db.execute({ sql: 'SELECT * FROM completions WHERE user_id=?', args: [req.userId] }),
      db.execute({ sql: 'SELECT gym_schedule, study_books FROM user_settings WHERE user_id=?', args: [req.userId] }),
    ]);

    const recMap = new Map();
    for (const r of recRes.rows) {
      recMap.set(r.task_id, r);
    }

    const subtasksMap = new Map();
    for (const s of subtasksRes.rows) {
      if (!subtasksMap.has(s.task_id)) subtasksMap.set(s.task_id, []);
      subtasksMap.get(s.task_id).push(mapSubtask(s));
    }

    const tasksWithNested = tasksRes.rows.map(t => {
      const mapped = mapTask(t, recMap.get(t.id));
      mapped.subtasks = subtasksMap.get(t.id) || [];
      return mapped;
    });

    const settingsRow = settingsRes.rows[0];
    const data = {
      categories: catsRes.rows.map(mapCategory),
      tasks: tasksWithNested,
      dailyPlans: plansRes.rows.map(mapPlan),
      completions: compRes.rows.map(mapCompletion),
      gymSchedule: settingsRow?.gym_schedule ? JSON.parse(settingsRow.gym_schedule) : null,
      studyBooks: settingsRow?.study_books ? JSON.parse(settingsRow.study_books) : null,
      exportedAt: nowISO(),
    };
    res.setHeader('Content-Disposition', `attachment; filename=bromise_backup_${new Date().toISOString().split('T')[0]}.json`);
    res.json(data);
  } catch (err) {
    console.error('Failed to export data:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * Shared atomic import / merge builder with cross-account PK collision remapping.
 * mode: 'replace' (full backup restore) | 'merge' (guest or offline data merge)
 */
async function executeScopedImportOrMerge(userId, body, mode) {
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const dailyPlans = Array.isArray(body.dailyPlans) ? body.dailyPlans : (Array.isArray(body.daily_plans) ? body.daily_plans : []);
  const completions = Array.isArray(body.completions) ? body.completions : [];
  const gymSchedule = body.gymSchedule || body.gym_schedule || null;
  const studyBooks = body.studyBooks || body.study_books || null;

  const now = nowISO();
  const incomingSubtasks = [];
  for (const t of tasks) {
    if (Array.isArray(t.subtasks)) {
      for (const s of t.subtasks) {
        if (s && s.id) incomingSubtasks.push(s.id);
      }
    }
  }

  const [
    otherCatIds,
    otherTaskIds,
    otherRecIds,
    otherSubIds,
    otherPlanIds,
    otherCompIds,
    myCatsRes,
    myTasksRes,
    myRecsRes,
    mySubsRes,
    myPlansRes,
    myCompsRes,
  ] = await Promise.all([
    findOtherUserOwnedIds('categories', categories.map(c => c.id), userId),
    findOtherUserOwnedIds('tasks', tasks.map(t => t.id), userId),
    findOtherUserOwnedIds('recurrence_rules', tasks.map(t => t.recurrenceRule?.id), userId),
    findOtherUserOwnedIds('subtasks', incomingSubtasks, userId),
    findOtherUserOwnedIds('daily_plans', dailyPlans.map(p => p.id), userId),
    findOtherUserOwnedIds('completions', completions.map(c => c.id), userId),
    db.execute({ sql: 'SELECT id, name FROM categories WHERE user_id=?', args: [userId] }),
    db.execute({ sql: 'SELECT id FROM tasks WHERE user_id=?', args: [userId] }),
    db.execute({ sql: 'SELECT task_id FROM recurrence_rules WHERE user_id=?', args: [userId] }),
    db.execute({ sql: 'SELECT id FROM subtasks WHERE user_id=?', args: [userId] }),
    db.execute({ sql: 'SELECT id, task_id, date, start_time FROM daily_plans WHERE user_id=?', args: [userId] }),
    db.execute({ sql: 'SELECT id, task_id, date FROM completions WHERE user_id=?', args: [userId] }),
  ]);

  const statements = [];
  if (mode === 'replace') {
    statements.push(
      { sql: 'DELETE FROM subtasks WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM completions WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM daily_plans WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM recurrence_rules WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM tasks WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM categories WHERE user_id = ?', args: [userId] }
    );
  }

  const myCatIds = mode === 'merge' ? new Set(myCatsRes.rows.map(r => r.id)) : new Set();
  const myCatByName = mode === 'merge'
    ? new Map(myCatsRes.rows.map(r => [String(r.name).trim().toLowerCase(), r.id]))
    : new Map();
  const myTaskIds = mode === 'merge' ? new Set(myTasksRes.rows.map(r => r.id)) : new Set();
  const myRecTaskIds = mode === 'merge' ? new Set(myRecsRes.rows.map(r => r.task_id)) : new Set();
  const mySubIds = mode === 'merge' ? new Set(mySubsRes.rows.map(r => r.id)) : new Set();
  const myPlanSig = mode === 'merge'
    ? new Set(myPlansRes.rows.map(r => `${r.task_id}::${r.date}::${r.start_time || ''}`))
    : new Set();
  const myCompSig = mode === 'merge'
    ? new Set(myCompsRes.rows.map(r => `${r.task_id}::${r.date}`))
    : new Set();

  const catIdMap = new Map();
  const seenCatIds = new Set();
  let insertedCategories = 0;

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    if (!c) continue;
    const rawId = c.id || `cat-${uid()}`;
    const catName = c.name || `Category ${i + 1}`;
    const normName = String(catName).trim().toLowerCase();

    if (mode === 'merge') {
      if (myCatIds.has(rawId)) {
        catIdMap.set(rawId, rawId);
        continue;
      }
      if (myCatByName.has(normName)) {
        catIdMap.set(rawId, myCatByName.get(normName));
        continue;
      }
    }

    let finalCatId = (!c.id || otherCatIds.has(c.id) || seenCatIds.has(c.id))
      ? `cat-${uid()}`
      : c.id;
    seenCatIds.add(finalCatId);
    catIdMap.set(rawId, finalCatId);

    const catIcon = c.icon || 'Sparkles';
    const catAccent = c.accent || '#8b5cf6';
    const catPos = Number.isInteger(c.position) ? c.position : (myCatIds.size + insertedCategories);
    const catCreated = c.createdAt || now;
    const catUpdated = c.updatedAt || catCreated;
    const archived = (c.archived || c.archivedAt) ? 1 : 0;

    statements.push({
      sql: 'INSERT INTO categories (id, user_id, name, icon, accent, position, created_at, updated_at, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [finalCatId, userId, catName, catIcon, catAccent, catPos, catCreated, catUpdated, archived],
    });
    insertedCategories++;
  }

  const fallbackCategoryId =
    catIdMap.values().next().value ||
    myCatsRes.rows[0]?.id ||
    null;

  const taskIdMap = new Map();
  const seenTaskIds = new Set();
  const seenSubIds = new Set();
  let insertedTasks = 0;

  for (const t of tasks) {
    if (!t) continue;
    const rawTaskId = t.id || `task-${uid()}`;
    const mappedCatId = catIdMap.get(t.categoryId) || (myCatIds.has(t.categoryId) ? t.categoryId : fallbackCategoryId);
    if (!mappedCatId) continue;

    if (mode === 'merge' && myTaskIds.has(rawTaskId)) {
      taskIdMap.set(rawTaskId, rawTaskId);
      continue;
    }

    const finalTaskId = (!t.id || otherTaskIds.has(t.id) || seenTaskIds.has(t.id))
      ? `task-${uid()}`
      : t.id;
    seenTaskIds.add(finalTaskId);
    taskIdMap.set(rawTaskId, finalTaskId);

    const title = t.title || 'Untitled Task';
    const notes = t.notes || null;
    const priority = (t.priority && ['low', 'medium', 'high'].includes(String(t.priority).toLowerCase()))
      ? String(t.priority).toLowerCase()
      : 'medium';
    const deadline = t.deadline || null;
    const isRecurring = t.isRecurring ? 1 : 0;
    const createdAt = t.createdAt || now;
    const updatedAt = t.updatedAt || createdAt;
    const archived = (t.archivedAt || t.archived) ? 1 : 0;

    statements.push({
      sql: 'INSERT INTO tasks (id, user_id, category_id, title, notes, priority, deadline, is_recurring, created_at, updated_at, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [finalTaskId, userId, mappedCatId, title, notes, priority, deadline, isRecurring, createdAt, updatedAt, archived],
    });
    insertedTasks++;

    if (t.recurrenceRule && isRecurring && !myRecTaskIds.has(finalTaskId)) {
      const rr = t.recurrenceRule;
      const finalRrId = (!rr.id || otherRecIds.has(rr.id)) ? `rec-${uid()}` : rr.id;
      const rrFreq = rr.frequency || 'daily';
      const rrStart = rr.startDate || createdAt.split('T')[0];
      const rrEnd = rr.endDate || null;
      const rrActive = rr.active !== false ? 1 : 0;

      statements.push({
        sql: 'INSERT OR IGNORE INTO recurrence_rules (id, user_id, task_id, frequency, start_date, end_date, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [finalRrId, userId, finalTaskId, rrFreq, rrStart, rrEnd, rrActive],
      });
    }

    if (Array.isArray(t.subtasks)) {
      for (let sIdx = 0; sIdx < t.subtasks.length; sIdx++) {
        const s = t.subtasks[sIdx];
        if (!s || !s.title) continue;
        if (mode === 'merge' && s.id && mySubIds.has(s.id)) continue;
        const finalSubId = (!s.id || otherSubIds.has(s.id) || seenSubIds.has(s.id)) ? `sub-${uid()}` : s.id;
        seenSubIds.add(finalSubId);
        statements.push({
          sql: 'INSERT OR IGNORE INTO subtasks (id, task_id, user_id, title, done, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [finalSubId, finalTaskId, userId, String(s.title), s.done ? 1 : 0, Number.isInteger(s.position) ? s.position : sIdx, s.createdAt || now],
        });
      }
    }
  }

  const seenPlanIds = new Set();
  for (let i = 0; i < dailyPlans.length; i++) {
    const p = dailyPlans[i];
    if (!p || !p.taskId) continue;
    const mappedTaskId = taskIdMap.get(p.taskId) || (myTaskIds.has(p.taskId) ? p.taskId : null);
    if (!mappedTaskId) continue;

    const planDate = p.date || now.split('T')[0];
    const planStart = p.startTime || p.timeSlot || null;
    const sig = `${mappedTaskId}::${planDate}::${planStart || ''}`;
    if (mode === 'merge' && myPlanSig.has(sig)) continue;
    myPlanSig.add(sig);

    let finalPlanId = (!p.id || otherPlanIds.has(p.id) || seenPlanIds.has(p.id))
      ? `plan-${userId}-${planDate}-${uid().slice(0, 8)}`
      : p.id;
    seenPlanIds.add(finalPlanId);

    const planPos = Number.isInteger(p.position) ? p.position : i;
    const planSrc = p.sourceType || 'normal';
    const planEnd = p.endTime || null;
    const planDur = Number.isInteger(p.durationMinutes) ? p.durationMinutes : null;
    const planComp = p.completed ? 1 : 0;

    statements.push({
      sql: 'INSERT OR IGNORE INTO daily_plans (id, user_id, task_id, date, position, source_type, start_time, end_time, duration_minutes, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [finalPlanId, userId, mappedTaskId, planDate, planPos, planSrc, planStart, planEnd, planDur, planComp],
    });
  }

  const seenCompIds = new Set();
  for (const c of completions) {
    if (!c || !c.taskId) continue;
    const mappedTaskId = taskIdMap.get(c.taskId) || (myTaskIds.has(c.taskId) ? c.taskId : null);
    if (!mappedTaskId) continue;

    const compDate = c.date || now.split('T')[0];
    const sig = `${mappedTaskId}::${compDate}`;
    if (mode === 'merge' && myCompSig.has(sig)) continue;
    myCompSig.add(sig);

    const finalCompId = (!c.id || otherCompIds.has(c.id) || seenCompIds.has(c.id))
      ? `comp-${userId}-${compDate}-${mappedTaskId}`
      : c.id;
    seenCompIds.add(finalCompId);

    const compCompleted = c.completed !== false ? 1 : 0;
    const compAt = c.completedAt || (compCompleted ? now : null);

    statements.push({
      sql: 'INSERT OR IGNORE INTO completions (id, user_id, task_id, date, completed, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [finalCompId, userId, mappedTaskId, compDate, compCompleted, compAt],
    });
  }

  if (statements.length > 0) {
    await db.batch(statements, 'write');
  }

  if (gymSchedule || studyBooks) {
    const existingSettings = await db.execute({
      sql: 'SELECT gym_schedule, study_books FROM user_settings WHERE user_id = ?',
      args: [userId],
    });
    const curRow = existingSettings.rows[0];
    let gymStr = curRow?.gym_schedule || null;
    let studyStr = curRow?.study_books || null;

    if (mode === 'replace') {
      if (gymSchedule) gymStr = JSON.stringify(gymSchedule);
      if (studyBooks) studyStr = JSON.stringify(studyBooks);
    } else {
      if (!gymStr && gymSchedule) gymStr = JSON.stringify(gymSchedule);
      if ((!studyStr || studyStr === '[]') && studyBooks && Array.isArray(studyBooks) && studyBooks.length > 0) {
        studyStr = JSON.stringify(studyBooks);
      }
    }

    if (gymStr !== (curRow?.gym_schedule || null) || studyStr !== (curRow?.study_books || null)) {
      await db.execute({
        sql: `INSERT INTO user_settings (user_id, gym_schedule, study_books, updated_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET
                gym_schedule = COALESCE(excluded.gym_schedule, user_settings.gym_schedule),
                study_books = COALESCE(excluded.study_books, user_settings.study_books),
                updated_at = excluded.updated_at`,
        args: [userId, gymStr, studyStr, now],
      });
    }
  }

  return {
    categories: mode === 'replace' ? categories.length : insertedCategories,
    tasks: mode === 'replace' ? tasks.length : insertedTasks,
  };
}

app.post('/api/import', requireAuth, async (req, res) => {
  const { categories, tasks } = req.body;
  if (!categories || !tasks || !Array.isArray(categories) || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'Invalid backup file: categories and tasks arrays are required' });
  }

  try {
    const count = await executeScopedImportOrMerge(req.userId, req.body, 'replace');
    res.json({ ok: true, count });
  } catch (e) {
    console.error('Import failed:', e);
    res.status(500).json({ error: e.message || 'Import failed' });
  }
});

app.post('/api/sync/merge', requireAuth, async (req, res) => {
  try {
    const count = await executeScopedImportOrMerge(req.userId, req.body || {}, 'merge');
    res.json({ ok: true, merged: count });
  } catch (e) {
    console.error('Sync merge failed:', e);
    res.status(500).json({ error: e.message || 'Merge failed' });
  }
});

app.post('/api/seed/reset', requireAuth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM completions WHERE user_id=?', args: [req.userId] });
  await db.execute({ sql: 'DELETE FROM daily_plans WHERE user_id=?', args: [req.userId] });
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// USER ROOM DATA (GYM & STUDY CROSS-DEVICE SYNC)
// ─────────────────────────────────────────
app.get('/api/user/rooms', requireAuth, async (req, res) => {
  try {
    const rowRes = await db.execute({
      sql: 'SELECT gym_schedule, study_books FROM user_settings WHERE user_id=?',
      args: [req.userId],
    });
    const row = rowRes.rows[0];
    res.json({
      gymSchedule: row && row.gym_schedule ? JSON.parse(row.gym_schedule) : null,
      studyBooks: row && row.study_books ? JSON.parse(row.study_books) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/rooms', requireAuth, async (req, res) => {
  try {
    const { gymSchedule, studyBooks } = req.body;
    const existing = await db.execute({
      sql: 'SELECT user_id FROM user_settings WHERE user_id=?',
      args: [req.userId],
    });

    const gymStr = gymSchedule ? JSON.stringify(gymSchedule) : null;
    const studyStr = studyBooks ? JSON.stringify(studyBooks) : null;

    if (existing.rows[0]) {
      await db.execute({
        sql: 'UPDATE user_settings SET gym_schedule=COALESCE(?, gym_schedule), study_books=COALESCE(?, study_books), updated_at=? WHERE user_id=?',
        args: [gymStr, studyStr, nowISO(), req.userId],
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO user_settings (user_id, gym_schedule, study_books, updated_at) VALUES (?, ?, ?, ?)',
        args: [req.userId, gymStr, studyStr, nowISO()],
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// SERVE VITE PRODUCTION BUILD
// ─────────────────────────────────────────
if (IS_PROD && !process.env.VERCEL) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`BROMISE server running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

app.ensureReady = db.ensureReady;

module.exports = app;
