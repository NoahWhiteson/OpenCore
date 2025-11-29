import { writeLog } from '../routes/logs.js';

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  const errorLevel = err.status >= 500 ? 'ERROR' : err.status >= 400 ? 'WARN' : 'INFO';
  writeLog(errorLevel, `HTTP ${err.status || 500}: ${err.message || 'Internal server error'}`, {
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
