import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CRASH_LOG_FILE = join(__dirname, '../.crash-log.json');
const RUNTIME_FILE = join(__dirname, '../.runtime.json');
const APP_LOG_FILE = join(__dirname, '../logs/app.log');

// Ensure logs directory exists
const logsDir = join(__dirname, '../logs');
try {
  fs.mkdirSync(logsDir, { recursive: true });
} catch (error) {
  // Directory might already exist
}

const router = express.Router();

// Helper function to read log file
function readLogFile(filePath, maxLines = 1000) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.slice(-maxLines); // Return last N lines
  } catch (error) {
    console.error(`Error reading log file ${filePath}:`, error);
    return [];
  }
}

// Helper function to write to log file
function writeLog(level, message, data = null) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data) : null
    };
    const logLine = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    fs.appendFileSync(APP_LOG_FILE, logLine, 'utf8');
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

// Get all logs
router.get('/', authenticateToken, (req, res) => {
  try {
    const { type = 'all', limit = 500 } = req.query;
    
    const logs = {
      application: [],
      crashes: [],
      system: []
    };

    // Application logs
    if (type === 'all' || type === 'application') {
      logs.application = readLogFile(APP_LOG_FILE, parseInt(limit));
    }

    // Crash logs
    if (type === 'all' || type === 'crashes') {
      try {
        if (fs.existsSync(CRASH_LOG_FILE)) {
          const crashData = JSON.parse(fs.readFileSync(CRASH_LOG_FILE, 'utf8'));
          logs.crashes = crashData.crashes || [];
        }
      } catch (error) {
        console.error('Error reading crash log:', error);
      }
    }

    // System/runtime info
    if (type === 'all' || type === 'system') {
      try {
        if (fs.existsSync(RUNTIME_FILE)) {
          const runtimeData = JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf8'));
          logs.system = [{
            type: 'runtime',
            startTime: runtimeData.startTime,
            uptime: Date.now() - runtimeData.startTime,
            timestamp: new Date().toISOString()
          }];
        }
      } catch (error) {
        console.error('Error reading runtime file:', error);
      }
    }

    res.json({ logs, count: {
      application: logs.application.length,
      crashes: logs.crashes.length,
      system: logs.system.length
    }});
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get logs for a specific server
router.get('/:serverId', authenticateToken, (req, res) => {
  try {
    const { serverId } = req.params;
    const { type = 'all', limit = 500 } = req.query;

    const logs = {
      application: [],
      crashes: [],
      system: []
    };

    // Filter application logs by server (if we add server context to logs)
    if (type === 'all' || type === 'application') {
      const allLogs = readLogFile(APP_LOG_FILE, parseInt(limit));
      // For now, return all logs. In the future, we can filter by serverId
      logs.application = allLogs;
    }

    // Crash logs (these are system-wide)
    if (type === 'all' || type === 'crashes') {
      try {
        if (fs.existsSync(CRASH_LOG_FILE)) {
          const crashData = JSON.parse(fs.readFileSync(CRASH_LOG_FILE, 'utf8'));
          logs.crashes = crashData.crashes || [];
        }
      } catch (error) {
        console.error('Error reading crash log:', error);
      }
    }

    res.json({ logs, serverId, count: {
      application: logs.application.length,
      crashes: logs.crashes.length,
      system: logs.system.length
    }});
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Export writeLog for use in other modules
export { writeLog };

export { router as logsRouter };

