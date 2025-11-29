import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createTerminal, getTerminals, getTerminal, deleteTerminal, updateTerminal, updateTerminalStartupCommands } from '../database/db.js';

const router = express.Router();

// Get all terminals for a server
router.get('/:serverId', authenticateToken, (req, res, next) => {
  try {
    const { serverId } = req.params;
    const terminals = getTerminals(serverId);
    res.json({ terminals });
  } catch (error) {
    next(error);
  }
});

// Get a specific terminal
router.get('/:serverId/:terminalId', authenticateToken, (req, res, next) => {
  try {
    const { terminalId } = req.params;
    const terminal = getTerminal(parseInt(terminalId));
    
    if (!terminal) {
      return res.status(404).json({ error: 'Terminal not found' });
    }
    
    res.json({ terminal });
  } catch (error) {
    next(error);
  }
});

// Create a new terminal
router.post('/:serverId', authenticateToken, (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { label, color, startupCommands } = req.body;
    
    if (!label || !color) {
      return res.status(400).json({ error: 'Label and color are required' });
    }
    
    const terminalId = createTerminal(serverId, label, color, startupCommands || null);
    const terminal = getTerminal(terminalId);
    
    res.status(201).json({ terminal });
  } catch (error) {
    next(error);
  }
});

// Update a terminal
router.put('/:serverId/:terminalId', authenticateToken, (req, res, next) => {
  try {
    const { terminalId } = req.params;
    const { label, color, startupCommands } = req.body;
    
    if (!label || !color) {
      return res.status(400).json({ error: 'Label and color are required' });
    }
    
    updateTerminal(parseInt(terminalId), label, color, startupCommands || null);
    const terminal = getTerminal(parseInt(terminalId));
    
    res.json({ terminal });
  } catch (error) {
    next(error);
  }
});

// Update startup commands only
router.patch('/:serverId/:terminalId/startup', authenticateToken, (req, res, next) => {
  try {
    const { terminalId } = req.params;
    const { startupCommands } = req.body;
    
    updateTerminalStartupCommands(parseInt(terminalId), startupCommands || null);
    const terminal = getTerminal(parseInt(terminalId));
    
    res.json({ terminal });
  } catch (error) {
    next(error);
  }
});

// Kill terminal session
router.post('/:serverId/:terminalId/kill', authenticateToken, async (req, res, next) => {
  try {
    const { serverId, terminalId } = req.params;
    const terminalServer = await import('../terminal-server.js');
    
    const killed = terminalServer.killTerminalSession(serverId, terminalId);
    
    if (killed) {
      res.json({ success: true, message: 'Terminal session killed' });
    } else {
      res.status(404).json({ error: 'Terminal session not found or already terminated' });
    }
  } catch (error) {
    next(error);
  }
});

// Restart terminal session
router.post('/:serverId/:terminalId/restart', authenticateToken, async (req, res, next) => {
  try {
    const { serverId, terminalId } = req.params;
    const { startupCommands } = req.body;
    const terminalServer = await import('../terminal-server.js');
    
    terminalServer.restartTerminalSession(serverId, terminalId, startupCommands || null);
    
    res.json({ success: true, message: 'Terminal session restarted' });
  } catch (error) {
    next(error);
  }
});

// Delete a terminal
router.delete('/:serverId/:terminalId', authenticateToken, (req, res, next) => {
  try {
    const { terminalId } = req.params;
    deleteTerminal(parseInt(terminalId));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export { router as terminalsRouter };

