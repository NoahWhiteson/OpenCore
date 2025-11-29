import express from 'express';
import si from 'systeminformation';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/system', authenticateToken, async (req, res, next) => {
  try {
    const [system, cpu, mem, fsSize, networkInterfaces] = await Promise.all([
      si.system().catch(() => ({})),
      si.cpu().catch(() => ({})),
      si.mem().catch(() => ({})),
      si.fsSize().catch(() => []),
      si.networkInterfaces().catch(() => [])
    ]);

    const stats = {
      system: {
        manufacturer: system.manufacturer,
        model: system.model,
        version: system.version,
        serial: system.serial,
        uuid: system.uuid,
        sku: system.sku
      },
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        vendor: cpu.vendor,
        family: cpu.family,
        model: cpu.model,
        stepping: cpu.stepping,
        revision: cpu.revision,
        voltage: cpu.voltage,
        speed: cpu.speed,
        speedMin: cpu.speedMin,
        speedMax: cpu.speedMax,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        processors: cpu.processors,
        socket: cpu.socket,
        flags: cpu.flags
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        active: mem.active,
        available: mem.available,
        buffers: mem.buffers,
        cached: mem.cached,
        swapTotal: mem.swapTotal,
        swapUsed: mem.swapUsed,
        swapFree: mem.swapFree
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
      network: (networkInterfaces || []).map(ni => ({
        iface: ni.iface,
        ifaceName: ni.ifaceName,
        default: ni.default,
        ip4: ni.ip4,
        ip4subnet: ni.ip4subnet,
        ip6: ni.ip6,
        ip6subnet: ni.ip6subnet,
        mac: ni.mac,
        internal: ni.internal,
        virtual: ni.virtual,
        mtu: ni.mtu,
        speed: ni.speed
      })),
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/cpu', authenticateToken, async (req, res, next) => {
  try {
    const [cpu, currentLoad, cpuTemperature] = await Promise.all([
      si.cpu().catch(() => ({})),
      si.currentLoad().catch(() => ({})),
      si.cpuTemperature().catch(() => ({}))
    ]);

    const stats = {
      info: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed
      },
      load: {
        currentLoad: currentLoad.currentLoad,
        currentLoadUser: currentLoad.currentLoadUser,
        currentLoadSystem: currentLoad.currentLoadSystem,
        currentLoadNice: currentLoad.currentLoadNice,
        currentLoadIdle: currentLoad.currentLoadIdle,
        currentLoadIowait: currentLoad.currentLoadIowait,
        currentLoadIrq: currentLoad.currentLoadIrq,
        currentLoadSteal: currentLoad.currentLoadSteal,
        cpus: currentLoad.cpus
      },
      temperature: cpuTemperature,
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/memory', authenticateToken, async (req, res, next) => {
  try {
    const mem = await si.mem().catch(() => ({}));
    
    const stats = {
      total: mem.total,
      free: mem.free,
      used: mem.used,
      active: mem.active,
      available: mem.available,
      buffers: mem.buffers,
      cached: mem.cached,
      swapTotal: mem.swapTotal,
      swapUsed: mem.swapUsed,
      swapFree: mem.swapFree,
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export { router as statsUnencryptedRouter };

