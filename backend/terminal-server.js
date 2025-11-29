import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const terminalSessions = new Map();

// Export function to get terminal sessions (for API routes)
export function getTerminalSession(serverId, terminalId) {
  const sessionKey = buildSessionKey(serverId, terminalId);
  return terminalSessions.get(sessionKey);
}

// Export function to kill a terminal session
export function killTerminalSession(serverId, terminalId) {
  const sessionKey = buildSessionKey(serverId, terminalId);
  const session = terminalSessions.get(sessionKey);
  if (session && session.terminal && !session.terminal.killed) {
    session.terminal.kill();
    terminalSessions.delete(sessionKey);
    return true;
  }
  return false;
}

// Export function to restart a terminal session
export function restartTerminalSession(serverId, terminalId, startupCommands = null) {
  const sessionKey = buildSessionKey(serverId, terminalId);
  const session = terminalSessions.get(sessionKey);
  
  // Kill existing session
  if (session && session.terminal && !session.terminal.killed) {
    session.terminal.kill();
  }
  terminalSessions.delete(sessionKey);
  
  // Create new session (startup commands are handled inside createShellSession)
  const newSession = createShellSession(serverId, terminalId, startupCommands);
  terminalSessions.set(sessionKey, newSession);
  
  return newSession;
}

function authenticateToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function buildSessionKey(serverId, terminalId) {
  return `${serverId || 'root'}:${terminalId || 'default'}`;
}

function createShellSession(serverId, terminalId, startupCommands = null) {
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
  const shellArgs = isWindows ? ['/K'] : ['-i'];
  // Always start on C:\ drive on Windows
  const startDir = isWindows ? 'C:\\' : process.env.HOME || '/';
  
  // Store startup commands for later execution
  const sessionStartupCommands = startupCommands;

  const env = { ...process.env };
  if (isWindows) {
    // Remove TERM to avoid confusion with Windows console
    delete env.TERM;
    env.COMSPEC = process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
    
    // Set environment variables to help Python tools work without a real console
    env.PYTHONUNBUFFERED = '1';
    env.PYTHONIOENCODING = 'utf-8';
    
    // Try to make prompt_toolkit work in non-console mode
    // These environment variables can help tools detect they're in a pipe/redirect scenario
    env._PROMPT_TOOLKIT_NO_CPR = '1';
    env.PROMPT_TOOLKIT_NO_CPR = '1';
    
    // Set console code page to UTF-8
    env.CHCP = '65001';
    
    // Try to make Windows think there's a console by setting these
    // Note: This is a workaround - prompt_toolkit will still fail, but some tools might work
    env.CONEMUANSI = 'ON';
  } else {
    env.TERM = 'xterm-256color';
  }

  let terminal;
  let isPty = false;

  // Use spawn with proper configuration
  terminal = spawn(shell, shellArgs, {
    cwd: startDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    windowsVerbatimArguments: isWindows,
    // On Windows, don't hide the console - this helps with console allocation
    // even though the console won't be visible, it allows tools to detect it
    windowsHide: false,
  });

  if (terminal.stdin) terminal.stdin.setDefaultEncoding('utf8');
  if (terminal.stdout) terminal.stdout.setEncoding('utf8');
  if (terminal.stderr) terminal.stderr.setEncoding('utf8');

  const session = {
    key: buildSessionKey(serverId, terminalId),
    serverId,
    terminalId,
    isWindows,
    terminal,
    clients: new Set(),
    startupCommands: sessionStartupCommands,
    outputBuffer: '', // Store complete terminal output buffer (preserves exact state)
    maxBufferSize: 100000, // Maximum buffer size in characters (~100KB)
  };
  
  // Execute startup commands after a short delay to ensure terminal is ready
  if (sessionStartupCommands && terminal.stdin && !terminal.stdin.destroyed) {
    setTimeout(() => {
      const commands = sessionStartupCommands.split('\n').filter(cmd => cmd.trim());
      commands.forEach((cmd, index) => {
        setTimeout(() => {
          if (terminal.stdin && !terminal.stdin.destroyed) {
            const input = cmd.trim() + (isWindows ? '\r\n' : '\n');
            terminal.stdin.write(input, 'utf8');
          }
        }, index * 500); // Delay each command by 500ms
      });
    }, 1000); // Wait 1 second for terminal to initialize
  }

  const broadcast = (type, data) => {
    // Store output in buffer (preserves exact terminal state including ANSI codes, cursor position, etc.)
    if (type === 'output' && data) {
      const output = data.toString();
      session.outputBuffer += output;
      
      // Trim buffer if it gets too large (keep the most recent output)
      if (session.outputBuffer.length > session.maxBufferSize) {
        // Keep the last 80% of the buffer
        const keepSize = Math.floor(session.maxBufferSize * 0.8);
        session.outputBuffer = session.outputBuffer.slice(-keepSize);
      }
    }

    // Broadcast to all connected clients
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({ type, data }));
        } catch (error) {
          console.error('Error broadcasting to client:', error);
        }
      }
    }
  };

  // Handle output
  terminal.stdout.on('data', (data) => broadcast('output', data.toString()));
  terminal.stderr.on('data', (data) => broadcast('output', data.toString()));

  terminal.on('exit', (code, signal) => {
    broadcast('exit', { code, signal });
    // Only remove session when terminal process exits
    terminalSessions.delete(session.key);
    console.log(`Terminal session ${session.key} ended (code: ${code}, signal: ${signal})`);
  });

  terminal.on('error', (error) => {
    broadcast('error', { message: error.message });
  });

  return session;
}

export function createTerminalServer(server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/api/terminal'
  });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const serverId = url.searchParams.get('serverId') || 'root';
    const terminalId = url.searchParams.get('terminalId') || `session-${Date.now()}`;

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    const decoded = authenticateToken(token);
    if (!decoded) {
      ws.close(1008, 'Invalid token');
      return;
    }

    const sessionKey = buildSessionKey(serverId, terminalId);
    let session = terminalSessions.get(sessionKey);

    if (!session) {
      // Try to get startup commands from database
      let startupCommands = null;
      try {
        const { getTerminal } = await import('./database/db.js');
        const terminalData = getTerminal(parseInt(terminalId));
        if (terminalData && terminalData.startup_commands) {
          startupCommands = terminalData.startup_commands;
        }
      } catch (error) {
        console.error('Error loading startup commands:', error);
      }
      
      session = createShellSession(serverId, terminalId, startupCommands);
      terminalSessions.set(sessionKey, session);
    }

    session.clients.add(ws);

    // Send connection status
    const isReconnect = session.clients.size > 1;
    ws.send(JSON.stringify({
      type: 'status',
      data: isReconnect 
        ? `Reconnected to ${serverId} • Terminal ${terminalId} (${session.clients.size} client(s))`
        : `Connected to ${serverId} • Terminal ${terminalId}`
    }));
    
    // Send stored output buffer to the newly connected client (preserves exact terminal state)
    if (session.outputBuffer && session.outputBuffer.length > 0) {
      // Send the complete buffer to restore exact terminal state
      ws.send(JSON.stringify({
        type: 'output',
        data: session.outputBuffer
      }));
    }
    
    // If reconnecting, send a message to indicate the session is still active
    if (isReconnect && session.terminal && !session.terminal.killed) {
      ws.send(JSON.stringify({
        type: 'output',
        data: '\r\n[Reconnected to existing terminal session]\r\n'
      }));
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'input' && session.terminal.stdin && !session.terminal.stdin.destroyed) {
          let input = String(data.data ?? '');

          if (session.isWindows) {
            input = input.replace(/\r?\n/g, '\r\n');
            if (input === '\x7f') {
              input = '\b';
            }
          }

          session.terminal.stdin.write(input, 'utf8');
        } else if (data.type === 'kill') {
          // Allow explicit kill command
          if (session.terminal && !session.terminal.killed) {
            session.terminal.kill();
            terminalSessions.delete(session.key);
          }
        }
      } catch (error) {
        console.error('Error handling terminal input:', error);
      }
    });

    ws.on('close', () => {
      session.clients.delete(ws);
      // Don't kill the terminal when clients disconnect - keep it running
      // The terminal will only be killed when explicitly requested or on server shutdown
      console.log(`Client disconnected from ${session.key}. ${session.clients.size} client(s) remaining.`);
    });
  });

  console.log('✅ Terminal WebSocket server started on /api/terminal');
}
