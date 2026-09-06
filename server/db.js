'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Put DB in /data for production persistence, or project root for dev
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'bromise.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create schema
db.exec(`
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
`);

// Safe migrations to add user_id column if upgrading existing DB
const tables = ['categories', 'tasks', 'recurrence_rules', 'daily_plans', 'completions'];
tables.forEach(table => {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(col => col.name === 'user_id')) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`).run();
    }
  } catch (err) {
    console.log(`Migration check for ${table}:`, err.message);
  }
});

// Migration: ensure subtasks table exists (for existing DBs)
try {
  db.exec(`
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
  `);
} catch (err) {
  console.log('Subtasks migration:', err.message);
}

module.exports = db;
