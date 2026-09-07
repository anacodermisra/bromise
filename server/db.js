'use strict';
const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data/bromise.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDB() {
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
  `);

  // Safe migrations to add user_id column if upgrading existing local DB
  const tables = ['categories', 'tasks', 'recurrence_rules', 'daily_plans', 'completions'];
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
}

// We let it run in background on startup
initDB().catch(err => console.error('DB Init Error:', err));

module.exports = db;
