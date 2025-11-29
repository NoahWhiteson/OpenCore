import express from 'express';
import si from 'systeminformation';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

const ALGORITHM = 'aes-256-gcm';

let _encryptionKey = null;
let _keyInitialized = false;

function getEncryptionKey() {
  if (_keyInitialized) {
    return _encryptionKey;
  }
  
  _keyInitialized = true;
  let key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    key = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️  ENCRYPTION_KEY not set in .env');
    console.warn(`⚠️  Generated temporary key: ${key}`);
    console.warn('⚠️  Add ENCRYPTION_KEY to .env to persist encryption key');
    _encryptionKey = key;
    return key;
  }
  
  if (key.length !== 64) {
    console.warn('⚠️  ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    key = crypto.randomBytes(32).toString('hex');
    console.warn(`⚠️  Generated temporary key: ${key}`);
    _encryptionKey = key;
    return key;
  }
  
  console.log('✅ Using ENCRYPTION_KEY from .env');
  _encryptionKey = key;
  return key;
}

function encrypt(text) {
  try {
    const encryptionKey = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    
    if (keyBuffer.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes');
    }
    
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

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

    const encrypted = encrypt(JSON.stringify(stats));
    res.json({ data: encrypted });
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

    const encrypted = encrypt(JSON.stringify(stats));
    res.json({ data: encrypted });
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

    const encrypted = encrypt(JSON.stringify(stats));
    res.json({ data: encrypted });
  } catch (error) {
    next(error);
  }
});

router.get('/network', authenticateToken, async (req, res, next) => {
  try {
    const [networkInterfaces, networkStats] = await Promise.all([
      si.networkInterfaces().catch(() => []),
      si.networkStats().catch(() => [])
    ]);

    const stats = {
      interfaces: (networkInterfaces || []).map(ni => ({
        iface: ni.iface,
        ifaceName: ni.ifaceName,
        ip4: ni.ip4,
        ip6: ni.ip6,
        mac: ni.mac,
        speed: ni.speed
      })),
      stats: (networkStats || []).map(ns => ({
        iface: ns.iface,
        operstate: ns.operstate,
        rx_bytes: ns.rx_bytes,
        rx_dropped: ns.rx_dropped,
        rx_errors: ns.rx_errors,
        tx_bytes: ns.tx_bytes,
        tx_dropped: ns.tx_dropped,
        tx_errors: ns.tx_errors,
        rx_sec: ns.rx_sec,
        tx_sec: ns.tx_sec,
        ms: ns.ms
      })),
      timestamp: new Date().toISOString()
    };

    const encrypted = encrypt(JSON.stringify(stats));
    res.json({ data: encrypted });
  } catch (error) {
    next(error);
  }
});

router.get('/storage', authenticateToken, async (req, res, next) => {
  try {
    const [fsSize, fsStats, blockDevices] = await Promise.all([
      si.fsSize().catch(() => []),
      si.fsStats().catch(() => []),
      si.blockDevices().catch(() => [])
    ]);

    const stats = {
      filesystems: (fsSize || []).map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        mount: fs.mount
      })),
      stats: (fsStats || []).map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        mount: fs.mount,
        read: fs.rx,
        write: fs.wx,
        ioRead: fs.rIO,
        ioWrite: fs.wIO
      })),
      blockDevices: (blockDevices || []).map(bd => ({
        name: bd.name,
        type: bd.type,
        fstype: bd.fstype,
        mount: bd.mount,
        size: bd.size,
        physical: bd.physical,
        uuid: bd.uuid,
        label: bd.label,
        model: bd.model,
        serial: bd.serial,
        removable: bd.removable,
        protocol: bd.protocol
      })),
      timestamp: new Date().toISOString()
    };

    const encrypted = encrypt(JSON.stringify(stats));
    res.json({ data: encrypted });
  } catch (error) {
    next(error);
  }
});

router.get('/processes', authenticateToken, async (req, res, next) => {
  try {
    const processes = await si.processes().catch(() => ({ all: 0, running: 0, blocked: 0, sleeping: 0, unknown: 0, list: [] }));
    
    const stats = {
      all: processes.all,
      running: processes.running,
      blocked: processes.blocked,
      sleeping: processes.sleeping,
      unknown: processes.unknown,
      list: (processes.list || []).map(p => ({
        pid: p.pid,
        parentPid: p.parentPid,
        name: p.name,
        cpu: p.cpu,
        cpuu: p.cpuu,
        mem: p.mem,
        priority: p.priority,
        memVsz: p.memVsz,
        memRss: p.memRss,
        nice: p.nice,
        started: p.started,
        state: p.state,
        tty: p.tty,
        user: p.user,
        command: p.command
      })),
      timestamp: new Date().toISOString()
    };

    const encrypted = encrypt(JSON.stringify(stats));
    res.json({ data: encrypted });
  } catch (error) {
    next(error);
  }
});

router.get('/applications', authenticateToken, async (req, res, next) => {
  try {
    const processes = await si.processes().catch(() => ({ list: [] }));
    
    const processList = (processes.list || []).map(p => ({
      pid: p.pid,
      parentPid: p.parentPid,
      name: p.name,
      path: p.path,
      command: p.command,
      commandLine: p.params || p.command,
      cpu: p.cpu,
      cpuu: p.cpuu,
      mem: p.mem,
      memVsz: p.memVsz,
      memRss: p.memRss,
      priority: p.priority,
      nice: p.nice,
      started: p.started,
      startTime: p.started,
      runtime: p.started ? Math.floor((Date.now() - new Date(p.started).getTime()) / 1000) : null,
      state: p.state,
      tty: p.tty,
      user: p.user,
      uid: p.uid,
      gid: p.gid,
      threads: p.threads,
      handles: p.handles,
      platform: p.platform,
      sessionId: p.sessionId
    }));

    const stats = {
      summary: {
        totalProcesses: processList.length,
        runningProcesses: processList.filter(p => p.state === 'running').length,
        totalMemory: processList.reduce((sum, p) => sum + (p.memRss || 0), 0),
        totalCpu: processList.reduce((sum, p) => sum + (p.cpu || 0), 0)
      },
      applications: processList.sort((a, b) => (b.cpu || 0) - (a.cpu || 0)),
      timestamp: new Date().toISOString()
    };

    const encrypted = encrypt(JSON.stringify(stats));
    res.json({ data: encrypted });
  } catch (error) {
    next(error);
  }
});

router.get('/applications/:pid', authenticateToken, async (req, res, next) => {
  try {
    const pid = parseInt(req.params.pid);
    
    if (isNaN(pid)) {
      return res.status(400).json({ error: 'Invalid PID' });
    }

    const [processLoad, allProcesses] = await Promise.all([
      si.processLoad(pid.toString()).catch(() => null),
      si.processes().catch(() => ({ list: [] }))
    ]);

    const process = allProcesses.list?.find(p => p.pid === pid) || processLoad;

    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }

    const stats = {
      pid: process.pid,
      parentPid: process.parentPid,
      name: process.name,
      path: process.path,
      command: process.command,
      commandLine: process.params || process.command,
      cpu: process.cpu,
      cpuu: process.cpuu,
      mem: process.mem,
      memVsz: process.memVsz,
      memRss: process.memRss,
      priority: process.priority,
      nice: process.nice,
      started: process.started,
      startTime: process.started,
      runtime: process.started ? Math.floor((Date.now() - new Date(process.started).getTime()) / 1000) : null,
      state: process.state,
      tty: process.tty,
      user: process.user,
      uid: process.uid,
      gid: process.gid,
      threads: process.threads,
      handles: process.handles,
      platform: process.platform,
      sessionId: process.sessionId,
      load: processLoad,
      timestamp: new Date().toISOString()
    };

    const encrypted = encrypt(JSON.stringify(stats));
    res.json({ data: encrypted });
  } catch (error) {
    next(error);
  }
});

export { router as statsRouter };
