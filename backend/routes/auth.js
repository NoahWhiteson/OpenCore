import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { writeLog } from './logs.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ 
      error: 'Too many login attempts, please try again later.' 
    });
  },
});

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || 'admin';
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || 'admin';
}

function validateInput(username, password) {
  const errors = [];

  if (!username || typeof username !== 'string') {
    errors.push('Username is required');
  } else {
    const trimmedUsername = username.trim();
    if (trimmedUsername.length === 0) {
      errors.push('Username cannot be empty');
    } else if (trimmedUsername.length > 100) {
      errors.push('Username is too long');
    }
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else {
    if (password.length === 0) {
      errors.push('Password cannot be empty');
    } else if (password.length > 500) {
      errors.push('Password is too long');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    username: username?.trim(),
    password: password?.trim()
  };
}

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const validation = validateInput(username, password);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const adminUsername = getAdminUsername();
    const adminPassword = getAdminPassword();

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const trimmedUsername = validation.username;
    const trimmedPassword = validation.password;

    if (trimmedUsername !== adminUsername || trimmedPassword !== adminPassword) {
      console.warn(`Failed login attempt for username: ${trimmedUsername} from IP: ${req.ip}`);
      writeLog('WARN', 'Failed login attempt', { username: trimmedUsername, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokenPayload = {
      username: trimmedUsername,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000)
    };

    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn,
      issuer: 'opencore-api',
      audience: 'opencore-client'
    });

    console.log(`Successful login for user: ${trimmedUsername} from IP: ${req.ip}`);
    writeLog('INFO', 'User logged in successfully', { username: trimmedUsername, ip: req.ip });

    res.json({
      success: true,
      token,
      expiresIn,
      user: {
        username: trimmedUsername,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
    }

    const token = parts[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'opencore-api',
      audience: 'opencore-client'
    }, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(403).json({ error: 'Token expired' });
        }
        if (err.name === 'JsonWebTokenError') {
          return res.status(403).json({ error: 'Invalid token' });
        }
        return res.status(403).json({ error: 'Token verification failed' });
      }

      res.json({
        valid: true,
        user: {
          username: decoded.username,
          role: decoded.role
        },
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
      });
    });
  } catch (error) {
    console.error('Token verification error:', error);
    next(error);
  }
});

export { router as authRouter };
