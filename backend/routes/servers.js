import express from 'express';
import si from 'systeminformation';
import { authenticateToken } from '../middleware/auth.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RUNTIME_FILE = join(__dirname, '../.runtime.json');
const CRASH_LOG_FILE = join(__dirname, '../.crash-log.json');

function getRuntime() {
  try {
    if (fs.existsSync(RUNTIME_FILE)) {
      const data = fs.readFileSync(RUNTIME_FILE, 'utf8');
      const runtime = JSON.parse(data);
      return {
        startTime: runtime.startTime,
        uptime: Date.now() - runtime.startTime,
        uptimeFormatted: formatUptime(Date.now() - runtime.startTime),
      };
    }
  } catch (error) {
    console.error('Error reading runtime file:', error);
  }
  
  const startTime = Date.now();
  try {
    fs.writeFileSync(RUNTIME_FILE, JSON.stringify({ startTime }), 'utf8');
  } catch (error) {
    console.error('Error writing runtime file:', error);
  }
  
  return {
    startTime,
    uptime: 0,
    uptimeFormatted: '0s',
  };
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getCrashHistory() {
  try {
    if (fs.existsSync(CRASH_LOG_FILE)) {
      const data = fs.readFileSync(CRASH_LOG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading crash log:', error);
  }
  return { crashes: [], lastCrash: null };
}

function logCrash(error) {
  try {
    const crashHistory = getCrashHistory();
    const crash = {
      timestamp: new Date().toISOString(),
      error: error.message || String(error),
      stack: error.stack,
    };
    crashHistory.crashes.push(crash);
    crashHistory.lastCrash = crash;
    crashHistory.crashes = crashHistory.crashes.slice(-10); // Keep last 10 crashes
    fs.writeFileSync(CRASH_LOG_FILE, JSON.stringify(crashHistory, null, 2), 'utf8');
  } catch (err) {
    console.error('Error logging crash:', err);
  }
}

// Initialize runtime on module load
const runtime = getRuntime();

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logCrash(error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logCrash(reason instanceof Error ? reason : new Error(String(reason)));
});

const router = express.Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const [system, cpu, mem, currentLoad, cpuTemperature, fsSize, networkInterfaces] = await Promise.all([
      si.system().catch(() => ({})),
      si.cpu().catch(() => ({})),
      si.mem().catch(() => ({})),
      si.currentLoad().catch(() => ({})),
      si.cpuTemperature().catch(() => ({})),
      si.fsSize().catch(() => []),
      si.networkInterfaces().catch(() => []),
    ]);

    const cpuUsage = currentLoad.currentLoad || 0;
    const memoryUsage = mem.total ? ((mem.used / mem.total) * 100) : 0;
    const crashHistory = getCrashHistory();
    const currentRuntime = getRuntime();

    const rootServer = {
      id: 'root',
      name: 'Root Server',
      type: 'root',
      status: 'online',
      lastSeen: new Date().toISOString(),
      runtime: {
        startTime: currentRuntime.startTime,
        uptime: currentRuntime.uptime,
        uptimeFormatted: currentRuntime.uptimeFormatted,
      },
      crashes: {
        total: crashHistory.crashes.length,
        lastCrash: crashHistory.lastCrash,
        hasRecentCrashes: crashHistory.crashes.some(c => {
          const crashTime = new Date(c.timestamp).getTime();
          return Date.now() - crashTime < 24 * 60 * 60 * 1000; // Last 24 hours
        }),
      },
      specs: {
        system: {
          manufacturer: system.manufacturer || 'Unknown',
          model: system.model || 'Unknown',
          version: system.version || 'Unknown',
        },
        cpu: {
          brand: cpu.brand || 'Unknown',
          cores: cpu.cores || 0,
          physicalCores: cpu.physicalCores || 0,
          speed: cpu.speed || 0,
        },
        memory: {
          total: mem.total || 0,
          used: mem.used || 0,
          available: mem.available || 0,
        },
        storage: (fsSize || []).map(fs => ({
          fs: fs.fs,
          type: fs.type,
          size: fs.size,
          used: fs.used,
          available: fs.available,
          use: fs.use,
        })),
        network: (networkInterfaces || []).filter(ni => ni.ip4).map(ni => ({
          name: ni.ifaceName || ni.iface,
          ip: ni.ip4,
          mac: ni.mac,
        })),
      },
      metrics: {
        cpu: cpuUsage,
        memory: memoryUsage,
        temperature: cpuTemperature.main || null,
      },
    };

    res.json({
      servers: [rootServer],
      total: 1,
    });
  } catch (error) {
    next(error);
  }
});

export { router as serversRouter };

