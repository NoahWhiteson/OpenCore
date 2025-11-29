import express from 'express';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeLog } from './logs.js';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// All update routes require authentication
router.use(authenticateToken);

// Root directory of the repo (two levels up from routes)
const ROOT_DIR = join(__dirname, '..', '..');

/**
 * Safely run a git command and return trimmed stdout or throw
 */
function runGit(command) {
  return execSync(command, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Check for updates from GitHub
 * Compares local HEAD with origin/main and returns commit hashes and messages
 */
router.get('/check', async (req, res, next) => {
  try {
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

    try {
      // Current commit + message
      const currentCommit = runGit('git rev-parse HEAD');
      const currentMessage = runGit('git log -1 --pretty=%s HEAD');

      // Fetch latest from origin
      execSync('git fetch origin', {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 10000,
      });

      // Remote commit + message
      const remoteCommit = runGit('git rev-parse origin/main');
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
    } catch (error) {
      results.backend.error = error.message;
      results.frontend.error = error.message;
      writeLog('WARN', 'Failed to check updates', { error: error.message });
    }

    res.json({
      success: true,
      updates: results,
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
 */
router.post('/update', async (req, res, next) => {
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

export { router as updatesRouter };


