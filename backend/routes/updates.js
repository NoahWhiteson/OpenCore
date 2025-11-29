import express from 'express';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import { writeLog } from './logs.js';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Root directory of the repo (two levels up from routes)
const ROOT_DIR = join(__dirname, '..', '..');

// Enable extra debug logging when troubleshooting update behaviour
const UPDATE_DEBUG = process.env.UPDATE_DEBUG === 'true';

// Auto-update settings
const AUTO_UPDATE_ENABLED = process.env.AUTO_UPDATE === 'true';
const AUTO_UPDATE_INTERVAL_MS = parseInt(process.env.AUTO_UPDATE_INTERVAL_MS || '900000', 10); // 15 minutes default

/**
 * Safely run a git command and return trimmed stdout or throw
 */
function runGit(command) {
  try {
    if (UPDATE_DEBUG) {
      console.log(`[updates] Running git command: "${command}" in ${ROOT_DIR}`);
    }

    const output = execSync(command, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (UPDATE_DEBUG) {
      console.log(`[updates] git output for "${command}": ${output}`);
    }

    return output;
  } catch (error) {
    if (UPDATE_DEBUG) {
      console.error(`[updates] git command failed: "${command}"`, error);
    }
    throw error;
  }
}

/**
 * Core update-check logic shared by API and auto-update scheduler
 */
function performUpdateCheck() {
  const results = {
    backend: {
      hasUpdate: false,
      currentCommit: null,
      currentMessage: null,
      remoteCommit: null,
      remoteMessage: null,
      error: null,
    },
    frontend: {
      hasUpdate: false,
      currentCommit: null,
      currentMessage: null,
      remoteCommit: null,
      remoteMessage: null,
      error: null,
    },
  };

  let remoteUrl = null;
  let currentCommit = null;
  let remoteCommit = null;

  try {
    // Current commit + message
    currentCommit = runGit('git rev-parse HEAD');
    const currentMessage = runGit('git log -1 --pretty=%s HEAD');
    remoteUrl = runGit('git config --get remote.origin.url');

    // Fetch latest from origin
    execSync('git fetch origin', {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10000,
    });

    // Remote commit + message
    remoteCommit = runGit('git rev-parse origin/main');
    const remoteMessage = runGit('git log -1 --pretty=%s origin/main');

    const hasUpdate = currentCommit !== remoteCommit;

    results.backend = {
      hasUpdate,
      currentCommit,
      currentMessage,
      remoteCommit,
      remoteMessage,
      error: null,
    };

    // Frontend is same repo, so same info
    results.frontend = { ...results.backend };

    if (UPDATE_DEBUG) {
      console.log('[updates] Update check result', {
        rootDir: ROOT_DIR,
        remoteUrl,
        currentCommit,
        remoteCommit,
        hasUpdate,
        os: {
          platform: os.platform(),
          release: os.release(),
          type: os.type(),
        },
        nodeEnv: process.env.NODE_ENV,
      });
    }
  } catch (error) {
    results.backend.error = error.message;
    results.frontend.error = error.message;
    writeLog('WARN', 'Failed to check updates', { error: error.message });
  }

  const debugInfo = {
    rootDir: ROOT_DIR,
    remoteUrl,
    os: {
      platform: os.platform(),
      release: os.release(),
      type: os.type(),
    },
    nodeEnv: process.env.NODE_ENV || 'development',
    currentCommit,
    remoteCommit,
  };

  return { results, debugInfo };
}

/**
 * Check for updates from GitHub
 * Compares local HEAD with origin/main and returns commit hashes and messages
 */
router.get('/check', async (req, res, next) => {
  try {
    const { results, debugInfo } = performUpdateCheck();

    res.json({
      success: true,
      updates: results,
      debug: debugInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking for updates:', error);
    writeLog('ERROR', 'Failed to check for updates', { error: error.message });
    next(error);
  }
});

/**
 * Update backend and/or frontend from GitHub
 * Pulls latest from origin/main and runs npm install / build where needed.
 * This route is protected by authentication.
 */
router.post('/update', authenticateToken, async (req, res, next) => {
  try {
    const { component } = req.body; // 'backend', 'frontend', or 'both'

    if (!['backend', 'frontend', 'both'].includes(component)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid component. Must be "backend", "frontend", or "both"',
      });
    }

    const results = {
      backend: { success: false, message: null, error: null },
      frontend: { success: false, message: null, error: null },
    };

    // Update backend
    if (component === 'backend' || component === 'both') {
      try {
        writeLog('INFO', 'Starting backend update', { component });

        // Pull latest changes
        execSync('git pull origin main', {
          cwd: ROOT_DIR,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 30000,
        });

        // Install backend dependencies
        execSync('npm install', {
          cwd: join(ROOT_DIR, 'backend'),
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 120000,
        });

        results.backend.success = true;
        results.backend.message =
          'Backend updated successfully. Restart may be required depending on how the server is run.';
        writeLog('INFO', 'Backend update completed', { component });
      } catch (error) {
        results.backend.error = error.message;
        writeLog('ERROR', 'Backend update failed', {
          error: error.message,
          component,
        });
      }
    }

    // Update frontend
    if (component === 'frontend' || component === 'both') {
      try {
        writeLog('INFO', 'Starting frontend update', { component });

        // Pull latest changes (if not already done)
        if (component === 'frontend') {
          execSync('git pull origin main', {
            cwd: ROOT_DIR,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 30000,
          });
        }

        // Install frontend dependencies
        execSync('npm install', {
          cwd: join(ROOT_DIR, 'frontend'),
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 120000,
        });

        // Rebuild frontend
        execSync('npm run build', {
          cwd: join(ROOT_DIR, 'frontend'),
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 300000,
        });

        results.frontend.success = true;
        results.frontend.message =
          'Frontend updated successfully. Refresh the browser to load the new version.';
        writeLog('INFO', 'Frontend update completed', { component });
      } catch (error) {
        results.frontend.error = error.message;
        writeLog('ERROR', 'Frontend update failed', {
          error: error.message,
          component,
        });
      }
    }

    const allSuccess =
      (component === 'both' &&
        results.backend.success &&
        results.frontend.success) ||
      (component === 'backend' && results.backend.success) ||
      (component === 'frontend' && results.frontend.success);

    res.json({
      success: allSuccess,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating:', error);
    writeLog('ERROR', 'Update operation failed', { error: error.message });
    next(error);
  }
});

/**
 * Get current version/commit info
 */
router.get('/version', async (req, res, next) => {
  try {
    let commit = null;
    let branch = null;
    let remote = null;
    let message = null;

    try {
      commit = runGit('git rev-parse HEAD');
      branch = runGit('git rev-parse --abbrev-ref HEAD');
      remote = runGit('git config --get remote.origin.url');
      message = runGit('git log -1 --pretty=%s HEAD');
    } catch (error) {
      // Not a git repository or git not available
      writeLog('WARN', 'Could not get version info', { error: error.message });
    }

    res.json({
      success: true,
      version: {
        commit: commit || 'unknown',
        branch: branch || 'unknown',
        remote: remote || 'unknown',
        message: message || 'unknown',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting version:', error);
    next(error);
  }
});

/**
 * Auto-update scheduler
 * When AUTO_UPDATE=true, periodically checks for updates and applies them automatically.
 * NOTE: For production, run the backend under a process manager (systemd, PM2, Docker)
 * so that if an update requires a restart you can safely handle process restarts.
 */
export function startAutoUpdateScheduler() {
  if (!AUTO_UPDATE_ENABLED) {
    if (UPDATE_DEBUG) {
      console.log('[updates] AUTO_UPDATE is disabled; auto-update scheduler not started');
    }
    return;
  }

  async function autoUpdateTick() {
    try {
      const { results, debugInfo } = performUpdateCheck();

      const hasUpdate =
        results.backend?.hasUpdate ||
        results.frontend?.hasUpdate;

      if (!hasUpdate) {
        if (UPDATE_DEBUG) {
          console.log('[updates] Auto-update: no updates available', debugInfo);
        }
        return;
      }

      writeLog('INFO', 'Auto-update: updates detected, applying', {
        currentCommit: debugInfo.currentCommit,
        remoteCommit: debugInfo.remoteCommit,
        remoteUrl: debugInfo.remoteUrl,
        os: debugInfo.os,
      });

      // Reuse the same logic as the manual /update endpoint (component 'both')
      await new Promise((resolve, reject) => {
        try {
          // Pull latest changes
          execSync('git pull origin main', {
            cwd: ROOT_DIR,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 30000,
          });

          // Install backend dependencies
          execSync('npm install', {
            cwd: join(ROOT_DIR, 'backend'),
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 120000,
          });

          // Install frontend dependencies
          execSync('npm install', {
            cwd: join(ROOT_DIR, 'frontend'),
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 120000,
          });

          // Rebuild frontend
          execSync('npm run build', {
            cwd: join(ROOT_DIR, 'frontend'),
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 300000,
          });

          writeLog('INFO', 'Auto-update: completed successfully', {
            os: debugInfo.os,
          });
          if (UPDATE_DEBUG) {
            console.log('[updates] Auto-update: completed successfully');
          }

          resolve(null);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      writeLog('ERROR', 'Auto-update tick failed', { error: error.message });
      if (UPDATE_DEBUG) {
        console.error('[updates] Auto-update tick failed', error);
      }
    }
  }

  // Run once on startup, then on interval
  autoUpdateTick();
  setInterval(autoUpdateTick, AUTO_UPDATE_INTERVAL_MS);

  console.log(
    `[updates] Auto-update scheduler started (interval: ${AUTO_UPDATE_INTERVAL_MS} ms, auto-update enabled: ${AUTO_UPDATE_ENABLED})`,
  );
}

export { router as updatesRouter };

