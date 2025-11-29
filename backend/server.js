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

const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  writeLog('INFO', 'Server started', { host: HOST, port: PORT, environment: process.env.NODE_ENV || 'development' });
  startScheduler();
});
