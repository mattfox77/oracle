#!/usr/bin/env tsx
/**
 * Oracle Migration Runner
 *
 * Applies SQL migration files from the migrations/ directory in order.
 * Tracks applied migrations in a `schema_migrations` table.
 *
 * Usage:
 *   npm run migrate          # Apply pending migrations
 *   npm run migrate status   # Show migration status
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'oracle',
  user: process.env.DB_USER || 'oracle',
  password: process.env.DB_PASSWORD || '',
});

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(result.rows.map(r => r.version));
}

function getMigrationFiles(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

async function applyMigration(filename: string): Promise<void> {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf-8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [filename]
    );
    await client.query('COMMIT');
    console.log(`  Applied: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to apply ${filename}: ${(error as Error).message}`);
  } finally {
    client.release();
  }
}

async function migrate(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();
  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('All migrations are up to date.');
    return;
  }

  console.log(`Applying ${pending.length} migration(s)...`);
  for (const file of pending) {
    await applyMigration(file);
  }
  console.log('Done.');
}

async function status(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();

  console.log('Migration status:');
  for (const file of files) {
    const marker = applied.has(file) ? '[applied]' : '[pending]';
    console.log(`  ${marker} ${file}`);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'up';

  try {
    switch (command) {
      case 'up':
        await migrate();
        break;
      case 'status':
        await status();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: migrate [up|status]');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
