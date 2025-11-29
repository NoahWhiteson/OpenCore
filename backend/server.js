import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const result = dotenv.config({ path: join(__dirname, '.env') });

if (result.error) {
  console.warn('⚠️  Error loading .env file:', result.error.message);
} else {
  console.log('✅ .env file loaded successfully');
  console.log('ENCRYPTION_KEY present:', !!process.env.ENCRYPTION_KEY);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { statsRouter } from './routes/stats.js';
import { statsUnencryptedRouter } from './routes/stats-unencrypted.js';
import { statsCombinedRouter } from './routes/stats-combined.js';
import { serversRouter } from './routes/servers.js';
import { metricsRouter } from './routes/metrics.js';
import { terminalsRouter } from './routes/terminals.js';
import { logsRouter } from './routes/logs.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startScheduler } from './database/scheduler.js';
import { createTerminalServer } from './terminal-server.js';
import { createServer } from 'http';
import { writeLog } from './routes/logs.js';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const server = createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  handler: (req, res) => {
    res.status(429).json({ 
      error: 'Too many requests from this IP, please try again later.' 
    });
  },
  skip: (req) => {
    return req.path.startsWith('/api/stats') || req.path.startsWith('/api/stats-unencrypted');
  },
});

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json());
app.use(limiter);

app.use('/api/auth', authRouter);
app.use('/api/stats', statsRouter);
app.use('/api/stats-unencrypted', statsUnencryptedRouter);
app.use('/api/stats-combined', statsCombinedRouter);
app.use('/api/servers', serversRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/terminals', terminalsRouter);
app.use('/api/logs', logsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

// Create WebSocket server for terminals
createTerminalServer(server);

// Force IPv4 binding to match frontend behavior
server.listen({
  port: PORT,
  host: HOST,
  family: 4  // Force IPv4
}, () => {
  const serverUrl = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
  console.log(`Server running on ${HOST}:${PORT} (IPv4)`);
  console.log(`Accessible at: ${serverUrl}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  writeLog('INFO', 'Server started', { host: HOST, port: PORT, family: 'IPv4', environment: process.env.NODE_ENV || 'development' });
  startScheduler();
});

// Handle errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please choose a different port.`);
  } else if (err.code === 'EACCES') {
    console.error(`Permission denied. Cannot bind to port ${PORT}. Try using a port above 1024 or run with sudo.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
