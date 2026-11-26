'use strict';
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const isVercel = Boolean(process.env.VERCEL);
const hasTursoUrl = Boolean(process.env.TURSO_DATABASE_URL);
const dbUrl = process.env.TURSO_DATABASE_URL || (isVercel ? 'file:/tmp/bromise.db' : 'file:./data/bromise.db');

if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace(/^file:/, '');
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }
}

const db = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function isPersistentCloudDb() {
  if (isVercel) return hasTursoUrl;
  return true;
}

async function initDB() {
  if (isVercel && !hasTursoUrl) {
    throw new Error('TURSO_DATABASE_URL is not configured on Vercel. Persistent storage requires a Turso LibSQL database URL.');
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      picture TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Sparkles',
      accent TEXT NOT NULL DEFAULT '#8b5cf6',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      deadline TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recurrence_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      task_id TEXT NOT NULL UNIQUE,
      frequency TEXT NOT NULL DEFAULT 'daily',
      start_date TEXT NOT NULL,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      task_id TEXT NOT NULL,
      date TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      source_type TEXT NOT NULL DEFAULT 'normal'
    );

    CREATE TABLE IF NOT EXISTS completions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      task_id TEXT NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      gym_schedule TEXT,
      study_books TEXT,
      updated_at TEXT
    );
  `);

  // Safe migrations to add user_id column if upgrading existing local DB
  const tables = ['categories', 'tasks', 'recurrence_rules', 'daily_plans', 'completions', 'subtasks'];
  for (const table of tables) {
    try {
      const res = await db.execute(`PRAGMA table_info(${table})`);
      if (!res.rows.some(col => col.name === 'user_id')) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`);
      }
    } catch (err) {
      console.log(`Migration check for ${table}:`, err.message);
    }
  }

  // Safe migrations for daily_plans custom timetable slots
  try {
    const planCols = await db.execute('PRAGMA table_info(daily_plans)');
    if (!planCols.rows.some(col => col.name === 'start_time')) {
      await db.execute('ALTER TABLE daily_plans ADD COLUMN start_time TEXT');
    }
    if (!planCols.rows.some(col => col.name === 'end_time')) {
      await db.execute('ALTER TABLE daily_plans ADD COLUMN end_time TEXT');
    }
    if (!planCols.rows.some(col => col.name === 'duration_minutes')) {
      await db.execute('ALTER TABLE daily_plans ADD COLUMN duration_minutes INTEGER DEFAULT 60');
    }
    if (!planCols.rows.some(col => col.name === 'completed')) {
      await db.execute('ALTER TABLE daily_plans ADD COLUMN completed INTEGER DEFAULT 0');
    }
  } catch (err) {
    console.log('Daily plans migration check:', err.message);
  }

  // Create indexes for performance optimization
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id, archived)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, archived)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id, user_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, date)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_daily_plans_task ON daily_plans(task_id, date)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_completions_user_date ON completions(user_id, date)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_completions_task_date ON completions(task_id, date)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_recurrence_task ON recurrence_rules(task_id, user_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id, user_id)');
  } catch (err) {
    console.log('Index creation check:', err.message);
  }
}

let readyPromise = null;
function ensureReady() {
  if (!readyPromise) {
    readyPromise = initDB().catch(err => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

// Kick off initialization eagerly in non-serverless local server mode
if (!isVercel) {
  ensureReady().catch(err => console.error('DB Init Error:', err));
}

db.ensureReady = ensureReady;
db.isPersistentCloudDb = isPersistentCloudDb;

module.exports = db;
