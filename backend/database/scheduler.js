import si from 'systeminformation';
import { saveMetrics } from './db.js';

let schedulerInterval = null;

export function startScheduler() {
  // Run immediately on start
  collectAndSaveMetrics();

  // Then run every hour
  schedulerInterval = setInterval(() => {
    collectAndSaveMetrics();
  }, 60 * 60 * 1000); // 1 hour in milliseconds

  console.log('✅ Metrics scheduler started - collecting data every hour');
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏹️  Metrics scheduler stopped');
  }
}

async function collectAndSaveMetrics() {
  try {
    const [cpu, mem, currentLoad, cpuTemperature, fsSize] = await Promise.all([
      si.cpu().catch(() => ({})),
      si.mem().catch(() => ({})),
      si.currentLoad().catch(() => ({})),
      si.cpuTemperature().catch(() => ({})),
      si.fsSize().catch(() => []),
    ]);

    const cpuUsage = currentLoad.currentLoad || 0;
    const memoryUsage = mem.total ? ((mem.used / mem.total) * 100) : 0;

    const metrics = {
      cpu: cpuUsage,
      memory: memoryUsage,
      memoryTotal: mem.total || 0,
      memoryUsed: mem.used || 0,
      memoryAvailable: mem.available || 0,
      temperature: cpuTemperature.main || null,
      storage: (fsSize || []).map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        mount: fs.mount
      })),
    };

    saveMetrics('root', metrics);
    console.log(`📊 Metrics saved at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('❌ Error collecting metrics:', error);
  }
}

