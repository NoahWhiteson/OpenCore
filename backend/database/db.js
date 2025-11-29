import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create database directory if it doesn't exist
const dbDir = join(__dirname, 'data');
try {
  mkdirSync(dbDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore
}

const dbPath = join(dbDir, 'metrics.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    cpu_usage REAL,
    memory_usage REAL,
    memory_total INTEGER,
    memory_used INTEGER,
    memory_available INTEGER,
    temperature REAL,
    storage_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_server_timestamp ON metrics(server_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_timestamp ON metrics(timestamp);

  CREATE TABLE IF NOT EXISTS terminals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL,
    startup_commands TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_terminal_server ON terminals(server_id);
`);

// Migration: Add startup_commands column if it doesn't exist
try {
  const tableInfo = db.prepare(`PRAGMA table_info(terminals)`).all();
  const hasStartupCommands = tableInfo.some(col => col.name === 'startup_commands');
  
  if (!hasStartupCommands) {
    db.exec(`ALTER TABLE terminals ADD COLUMN startup_commands TEXT;`);
    console.log('✅ Added startup_commands column to terminals table');
  }
} catch (error) {
  console.error('Error checking/adding startup_commands column:', error);
}

export function saveMetrics(serverId, metrics) {
  const stmt = db.prepare(`
    INSERT INTO metrics (
      server_id, timestamp, cpu_usage, memory_usage, 
      memory_total, memory_used, memory_available, 
      temperature, storage_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const timestamp = new Date().toISOString();
  const storageData = JSON.stringify(metrics.storage || []);

  stmt.run(
    serverId,
    timestamp,
    metrics.cpu || null,
    metrics.memory || null,
    metrics.memoryTotal || null,
    metrics.memoryUsed || null,
    metrics.memoryAvailable || null,
    metrics.temperature || null,
    storageData
  );
}

export function getMetrics(serverId, startDate, endDate) {
  const stmt = db.prepare(`
    SELECT * FROM metrics
    WHERE server_id = ?
    AND timestamp >= ?
    AND timestamp <= ?
    ORDER BY timestamp ASC
  `);

  return stmt.all(serverId, startDate, endDate);
}

export function getLatestMetrics(serverId, limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM metrics
    WHERE server_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  return stmt.all(serverId, limit);
}

export function getMetricsByDateRange(serverId, startDate, endDate) {
  const stmt = db.prepare(`
    SELECT * FROM metrics
    WHERE server_id = ?
    AND DATE(timestamp) >= DATE(?)
    AND DATE(timestamp) <= DATE(?)
    ORDER BY timestamp ASC
  `);

  return stmt.all(serverId, startDate, endDate);
}

// Terminal functions
export function createTerminal(serverId, label, color, startupCommands = null) {
  const stmt = db.prepare(`
    INSERT INTO terminals (server_id, label, color, startup_commands)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(serverId, label, color, startupCommands);
  return result.lastInsertRowid;
}

export function getTerminals(serverId) {
  const stmt = db.prepare(`
    SELECT * FROM terminals
    WHERE server_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(serverId);
}

export function getTerminal(terminalId) {
  const stmt = db.prepare(`
    SELECT * FROM terminals
    WHERE id = ?
  `);
  
  return stmt.get(terminalId);
}

export function deleteTerminal(terminalId) {
  const stmt = db.prepare(`
    DELETE FROM terminals
    WHERE id = ?
  `);
  
  return stmt.run(terminalId);
}

export function updateTerminal(terminalId, label, color, startupCommands = null) {
  const stmt = db.prepare(`
    UPDATE terminals
    SET label = ?, color = ?, startup_commands = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  return stmt.run(label, color, startupCommands, terminalId);
}

export function updateTerminalStartupCommands(terminalId, startupCommands) {
  const stmt = db.prepare(`
    UPDATE terminals
    SET startup_commands = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  return stmt.run(startupCommands, terminalId);
}

export { db };

