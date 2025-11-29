import express from 'express';
import si from 'systeminformation';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/all', authenticateToken, async (req, res, next) => {
  try {
    const [system, cpu, mem, currentLoad, cpuTemperature, fsSize] = await Promise.all([
      si.system().catch(() => ({})),
      si.cpu().catch(() => ({})),
      si.mem().catch(() => ({})),
      si.currentLoad().catch(() => ({})),
      si.cpuTemperature().catch(() => ({})),
      si.fsSize().catch(() => []),
    ]);

    const stats = {
      system: {
        manufacturer: system.manufacturer,
        model: system.model,
        version: system.version,
      },
      cpu: {
        info: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          speed: cpu.speed,
        },
        load: {
          currentLoad: currentLoad.currentLoad,
          currentLoadUser: currentLoad.currentLoadUser,
          currentLoadSystem: currentLoad.currentLoadSystem,
          cpus: currentLoad.cpus,
        },
        temperature: cpuTemperature,
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        active: mem.active,
        available: mem.available,
      },
      storage: (fsSize || []).map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        mount: fs.mount
      })),
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export { router as statsCombinedRouter };

