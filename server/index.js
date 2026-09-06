'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

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

// ─────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: nowISO() });
});

// ─────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────
app.get('/api/categories', (_req, res) => {
  const rows = db.prepare('SELECT * FROM categories WHERE archived = 0 ORDER BY position ASC').all();
  res.json(rows.map(mapCategory));
});

app.post('/api/categories', (req, res) => {
  const { name, icon = 'Sparkles', accent = '#8b5cf6' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM categories').get().m;
  const id = req.body.id || `cat-${uid()}`;
  const now = nowISO();
  db.prepare('INSERT INTO categories (id,name,icon,accent,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, name, icon, accent, maxPos + 1, now, now);
  const row = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
  res.status(201).json(mapCategory(row));
});

app.put('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const now = nowISO();
  const name = req.body.name ?? existing.name;
  const icon = req.body.icon ?? existing.icon;
  const accent = req.body.accent ?? existing.accent;
  const position = req.body.position ?? existing.position;
  db.prepare('UPDATE categories SET name=?,icon=?,accent=?,position=?,updated_at=? WHERE id=?')
    .run(name, icon, accent, position, now, id);
  const row = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
  res.json(mapCategory(row));
});

app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  const { action, targetCategoryId } = req.body;
  if (!db.prepare('SELECT id FROM categories WHERE id=?').get(id)) {
    return res.status(404).json({ error: 'not found' });
  }
  if (action === 'move' && targetCategoryId) {
    db.prepare('UPDATE tasks SET category_id=?, updated_at=? WHERE category_id=?')
      .run(targetCategoryId, nowISO(), id);
  } else {
    // delete tasks in this category
    const taskIds = db.prepare('SELECT id FROM tasks WHERE category_id=?').all(id).map(r => r.id);
    for (const tid of taskIds) {
      db.prepare('DELETE FROM daily_plans WHERE task_id=?').run(tid);
      db.prepare('DELETE FROM completions WHERE task_id=?').run(tid);
      db.prepare('DELETE FROM recurrence_rules WHERE task_id=?').run(tid);
    }
    db.prepare('DELETE FROM tasks WHERE category_id=?').run(id);
  }
  const now = nowISO();
  // Re-index positions
  const remaining = db.prepare('SELECT id FROM categories WHERE id != ? ORDER BY position ASC').all(id);
  const reindex = db.prepare('UPDATE categories SET position=?,updated_at=? WHERE id=?');
  remaining.forEach((r, i) => reindex.run(i, now, r.id));
  db.prepare('DELETE FROM categories WHERE id=?').run(id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────
app.get('/api/tasks', (_req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE archived = 0 ORDER BY created_at ASC').all();
  const result = tasks.map(t => {
    const rec = db.prepare('SELECT * FROM recurrence_rules WHERE task_id=?').get(t.id);
    return mapTask(t, rec);
  });
  res.json(result);
});

app.post('/api/tasks', (req, res) => {
  const { title, categoryId, notes, priority = 'medium', deadline, isRecurring = false, recurrenceRule } = req.body;
  if (!title || !categoryId) return res.status(400).json({ error: 'title and categoryId required' });
  const id = req.body.id || `task-${uid()}`;
  const now = nowISO();
  db.prepare('INSERT INTO tasks (id,category_id,title,notes,priority,deadline,is_recurring,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, categoryId, title, notes || null, priority, deadline || null, isRecurring ? 1 : 0, now, now);
  let rec = null;
  if (isRecurring) {
    const recId = (recurrenceRule && recurrenceRule.id) || `rec-${uid()}`;
    const startDate = (recurrenceRule && recurrenceRule.startDate) || now.split('T')[0];
    db.prepare('INSERT INTO recurrence_rules (id,task_id,frequency,start_date,active) VALUES (?,?,?,?,?)')
      .run(recId, id, 'daily', startDate, 1);
    rec = db.prepare('SELECT * FROM recurrence_rules WHERE task_id=?').get(id);
  }
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  res.status(201).json(mapTask(task, rec));
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const now = nowISO();
  const title = req.body.title ?? existing.title;
  const categoryId = req.body.categoryId ?? existing.category_id;
  const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;
  const priority = req.body.priority ?? existing.priority;
  const deadline = req.body.deadline !== undefined ? req.body.deadline : existing.deadline;
  const isRecurring = req.body.isRecurring !== undefined ? (req.body.isRecurring ? 1 : 0) : existing.is_recurring;
  db.prepare('UPDATE tasks SET category_id=?,title=?,notes=?,priority=?,deadline=?,is_recurring=?,updated_at=? WHERE id=?')
    .run(categoryId, title, notes || null, priority, deadline || null, isRecurring, now, id);
  // Update recurrence rule if provided (does NOT delete historical completions)
  if (req.body.recurrenceRule && isRecurring) {
    const rr = req.body.recurrenceRule;
    const existing_rec = db.prepare('SELECT * FROM recurrence_rules WHERE task_id=?').get(id);
    if (existing_rec) {
      db.prepare('UPDATE recurrence_rules SET frequency=?,start_date=?,end_date=?,active=? WHERE task_id=?')
        .run(rr.frequency || 'daily', rr.startDate || existing_rec.start_date, rr.endDate || null, rr.active !== false ? 1 : 0, id);
    } else {
      db.prepare('INSERT INTO recurrence_rules (id,task_id,frequency,start_date,active) VALUES (?,?,?,?,?)')
        .run(`rec-${uid()}`, id, rr.frequency || 'daily', rr.startDate || now.split('T')[0], 1);
    }
  } else if (!isRecurring) {
    // deactivate rule but keep it so historical data is stable
    db.prepare('UPDATE recurrence_rules SET active=0 WHERE task_id=?').run(id);
  }
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  const rec = db.prepare('SELECT * FROM recurrence_rules WHERE task_id=?').get(id);
  res.json(mapTask(task, rec));
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM tasks WHERE id=?').get(id)) {
    return res.status(404).json({ error: 'not found' });
  }
  // Remove future plans only, keep historical completions & plans for analytics integrity
  const today = new Date().toISOString().split('T')[0];
  db.prepare("DELETE FROM daily_plans WHERE task_id=? AND date > ?").run(id, today);
  db.prepare('UPDATE tasks SET archived=1, updated_at=? WHERE id=?').run(nowISO(), id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// DAILY PLANS
// ─────────────────────────────────────────
app.get('/api/plans', (req, res) => {
  const { date } = req.query;
  let rows;
  if (date) {
    // Auto-add recurring tasks for the date if not present
    const recurringTasks = db.prepare('SELECT t.id FROM tasks t JOIN recurrence_rules r ON r.task_id=t.id WHERE t.archived=0 AND r.active=1 AND r.start_date <= ?').all(date);
    const stmt = db.prepare('INSERT OR IGNORE INTO daily_plans (id,task_id,date,position,source_type) VALUES (?,?,?,?,?)');
    const countStmt = db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM daily_plans WHERE date=?');
    recurringTasks.forEach(t => {
      const existing = db.prepare('SELECT id FROM daily_plans WHERE task_id=? AND date=?').get(t.id, date);
      if (!existing) {
        const maxPos = countStmt.get(date).m;
        stmt.run(`plan-${date}-${t.id}`, t.id, date, maxPos + 1, 'recurring');
      }
    });
    rows = db.prepare('SELECT * FROM daily_plans WHERE date=? ORDER BY position ASC').all(date);
  } else {
    rows = db.prepare('SELECT * FROM daily_plans ORDER BY date DESC, position ASC').all();
  }
  res.json(rows.map(mapPlan));
});

app.post('/api/plans', (req, res) => {
  const { taskId, date, position, sourceType = 'normal' } = req.body;
  if (!taskId || !date) return res.status(400).json({ error: 'taskId and date required' });
  const existing = db.prepare('SELECT * FROM daily_plans WHERE task_id=? AND date=?').get(taskId, date);
  if (existing) return res.json(mapPlan(existing)); // idempotent
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM daily_plans WHERE date=?').get(date).m;
  const id = `plan-${date}-${taskId}`;
  db.prepare('INSERT INTO daily_plans (id,task_id,date,position,source_type) VALUES (?,?,?,?,?)')
    .run(id, taskId, date, position !== undefined ? position : maxPos + 1, sourceType);
  const row = db.prepare('SELECT * FROM daily_plans WHERE id=?').get(id);
  res.status(201).json(mapPlan(row));
});

app.delete('/api/plans/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM daily_plans WHERE id=?').run(id);
  res.json({ ok: true });
});

app.put('/api/plans/reorder', (req, res) => {
  const { date, orderedTaskIds } = req.body;
  if (!date || !Array.isArray(orderedTaskIds)) return res.status(400).json({ error: 'date and orderedTaskIds required' });
  const stmt = db.prepare('UPDATE daily_plans SET position=? WHERE task_id=? AND date=?');
  orderedTaskIds.forEach((taskId, idx) => stmt.run(idx, taskId, date));
  const rows = db.prepare('SELECT * FROM daily_plans WHERE date=? ORDER BY position ASC').all(date);
  res.json(rows.map(mapPlan));
});

// ─────────────────────────────────────────
// COMPLETIONS
// ─────────────────────────────────────────
app.get('/api/completions', (req, res) => {
  const { date } = req.query;
  let rows;
  if (date) {
    rows = db.prepare('SELECT * FROM completions WHERE date=?').all(date);
  } else {
    rows = db.prepare('SELECT * FROM completions ORDER BY date DESC').all();
  }
  res.json(rows.map(mapCompletion));
});

app.post('/api/completions/toggle', (req, res) => {
  const { taskId, date } = req.body;
  if (!taskId || !date) return res.status(400).json({ error: 'taskId and date required' });
  const existing = db.prepare('SELECT * FROM completions WHERE task_id=? AND date=?').get(taskId, date);
  let isNowCompleted;
  const id = `comp-${date}-${taskId}`;
  if (existing) {
    isNowCompleted = !existing.completed;
    db.prepare('UPDATE completions SET completed=?,completed_at=? WHERE task_id=? AND date=?')
      .run(isNowCompleted ? 1 : 0, isNowCompleted ? nowISO() : null, taskId, date);
  } else {
    isNowCompleted = true;
    db.prepare('INSERT INTO completions (id,task_id,date,completed,completed_at) VALUES (?,?,?,?,?)')
      .run(id, taskId, date, 1, nowISO());
  }
  const row = db.prepare('SELECT * FROM completions WHERE task_id=? AND date=?').get(taskId, date);
  res.json(mapCompletion(row));
});

// ─────────────────────────────────────────
// STATS & ANALYTICS
// ─────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  const plans = db.prepare('SELECT * FROM daily_plans WHERE date=?').all(date);
  const plannedCount = plans.length;
  let completedCount = 0;
  const catNames = new Set();
  for (const plan of plans) {
    const comp = db.prepare('SELECT completed FROM completions WHERE task_id=? AND date=?').get(plan.task_id, date);
    if (comp && comp.completed) completedCount++;
    const task = db.prepare('SELECT category_id FROM tasks WHERE id=?').get(plan.task_id);
    if (task) {
      const cat = db.prepare('SELECT name FROM categories WHERE id=?').get(task.category_id);
      if (cat) catNames.add(cat.name);
    }
  }
  const percentage = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;
  res.json({ date, plannedCount, completedCount, percentage, categoriesRepresented: [...catNames] });
});

app.get('/api/stats/streak', (_req, res) => {
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
    const planned = db.prepare('SELECT COUNT(*) as c FROM daily_plans WHERE date=?').get(dateStr).c;
    const completed = db.prepare('SELECT COUNT(*) as c FROM completions WHERE date=? AND completed=1').get(dateStr).c;
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

app.get('/api/stats/heatmap', (req, res) => {
  const days = parseInt(req.query.days || '364', 10);
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const planned = db.prepare('SELECT COUNT(*) as c FROM daily_plans WHERE date=?').get(dateStr).c;
    const completed = db.prepare('SELECT COUNT(*) as c FROM completions WHERE date=? AND completed=1').get(dateStr).c;
    const percentage = planned > 0 ? Math.round((completed / planned) * 100) : 0;
    result.push({ date: dateStr, plannedCount: planned, completedCount: completed, percentage });
  }
  res.json(result);
});

// ─────────────────────────────────────────
// EXPORT / IMPORT / RESET
// ─────────────────────────────────────────
app.get('/api/export', (_req, res) => {
  const data = {
    categories: db.prepare('SELECT * FROM categories').all().map(mapCategory),
    tasks: db.prepare('SELECT * FROM tasks').all().map(t => mapTask(t, db.prepare('SELECT * FROM recurrence_rules WHERE task_id=?').get(t.id))),
    dailyPlans: db.prepare('SELECT * FROM daily_plans').all().map(mapPlan),
    completions: db.prepare('SELECT * FROM completions').all().map(mapCompletion),
    exportedAt: nowISO(),
  };
  res.setHeader('Content-Disposition', `attachment; filename=bromise_backup_${new Date().toISOString().split('T')[0]}.json`);
  res.json(data);
});

app.post('/api/import', (req, res) => {
  const { categories, tasks, dailyPlans, completions } = req.body;
  if (!categories || !tasks) return res.status(400).json({ error: 'Invalid backup file' });
  const importAll = db.transaction(() => {
    db.prepare('DELETE FROM completions').run();
    db.prepare('DELETE FROM daily_plans').run();
    db.prepare('DELETE FROM recurrence_rules').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM categories').run();
    for (const c of categories) {
      db.prepare('INSERT INTO categories (id,name,icon,accent,position,created_at,updated_at,archived) VALUES (?,?,?,?,?,?,?,?)').run(
        c.id, c.name, c.icon, c.accent, c.position, c.createdAt, c.updatedAt || c.createdAt, 0
      );
    }
    for (const t of tasks) {
      db.prepare('INSERT INTO tasks (id,category_id,title,notes,priority,deadline,is_recurring,created_at,updated_at,archived) VALUES (?,?,?,?,?,?,?,?,?,?)').run(
        t.id, t.categoryId, t.title, t.notes || null, t.priority, t.deadline || null, t.isRecurring ? 1 : 0, t.createdAt, t.updatedAt, 0
      );
      if (t.recurrenceRule) {
        const rr = t.recurrenceRule;
        db.prepare('INSERT OR IGNORE INTO recurrence_rules (id,task_id,frequency,start_date,end_date,active) VALUES (?,?,?,?,?,?)').run(
          rr.id, t.id, rr.frequency || 'daily', rr.startDate, rr.endDate || null, rr.active !== false ? 1 : 0
        );
      }
    }
    for (const p of (dailyPlans || [])) {
      db.prepare('INSERT OR IGNORE INTO daily_plans (id,task_id,date,position,source_type) VALUES (?,?,?,?,?)').run(
        p.id, p.taskId, p.date, p.position, p.sourceType || 'normal'
      );
    }
    for (const c of (completions || [])) {
      db.prepare('INSERT OR IGNORE INTO completions (id,task_id,date,completed,completed_at) VALUES (?,?,?,?,?)').run(
        c.id, c.taskId, c.date, c.completed ? 1 : 0, c.completedAt || null
      );
    }
  });
  try { importAll(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/seed/reset', (_req, res) => {
  // Only clears completions and plans, keeps tasks/categories intact
  // (Full reset happens via import)
  db.prepare('DELETE FROM completions').run();
  db.prepare('DELETE FROM daily_plans').run();
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// SERVE VITE PRODUCTION BUILD
// ─────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`BROMISE server running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
});

