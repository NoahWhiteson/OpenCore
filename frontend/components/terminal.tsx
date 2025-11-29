'use client'

import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';

// Polyfill for 'self' in browser context
if (typeof window !== 'undefined') {
  (globalThis as any).self = globalThis;
  (window as any).self = window;
}

interface TerminalProps {
  serverId: string;
  terminalId: string;
  token: string;
  onCommandReady?: (sendCommand: (command: string) => void) => void;
}

export function Terminal({ serverId, terminalId, token, onCommandReady }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let isMounted = true;
    let xterm: any = null;
    let fitAddon: any = null;
    let webLinksAddon: any = null;

    const initialize = async () => {
      try {
        // Import xterm modules
        const { Terminal: XTerm } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');
        const { WebLinksAddon } = await import('@xterm/addon-web-links');

        if (!isMounted || !containerRef.current) return;

        // Create xterm instance
        xterm = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Consolas, "Courier New", monospace',
          theme: {
            background: '#0C0C0C',
            foreground: '#CCCCCC',
            cursor: '#FFFFFF',
            cursorAccent: '#000000',
            selectionForeground: '#FFFFFF33',
            black: '#0C0C0C',
            red: '#C50F1F',
            green: '#13A10E',
            yellow: '#C19C00',
            blue: '#0037DA',
            magenta: '#881798',
            cyan: '#3A96DD',
            white: '#CCCCCC',
            brightBlack: '#767676',
            brightRed: '#E74856',
            brightGreen: '#16C60C',
            brightYellow: '#F9F1A5',
            brightBlue: '#3B78FF',
            brightMagenta: '#B4009E',
            brightCyan: '#61D6D6',
            brightWhite: '#F2F2F2',
          },
        });

        // Load addons
        fitAddon = new FitAddon();
        webLinksAddon = new WebLinksAddon();
        xterm.loadAddon(fitAddon);
        xterm.loadAddon(webLinksAddon);

        // Open terminal
        xterm.open(containerRef.current);

        // Fit terminal to container
        setTimeout(() => {
          try {
            fitAddon?.fit();
          } catch (err) {
            console.error('Error fitting terminal:', err);
          }
        }, 0);

        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        // Create sendCommand function
        const sendCommand = (command: string) => {
          if (typeof command !== 'string') return;
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            const payload = command.endsWith('\n') ? command : `${command}\n`;
            ws.send(JSON.stringify({ type: 'input', data: payload }));
          }
        };

        // Expose sendCommand to parent
        if (onCommandReady) {
          onCommandReady(sendCommand);
        }

        // Connect WebSocket
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const overrideWs = process.env.NEXT_PUBLIC_TERMINAL_WS_URL || process.env.NEXT_PUBLIC_WS_URL;
        const baseUrl = overrideWs || apiUrl;
        const wsUrl = baseUrl.startsWith('ws') ? baseUrl : baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
        const ws = new WebSocket(`${wsUrl.replace(/\/$/, '')}/api/terminal?token=${encodeURIComponent(token)}&serverId=${encodeURIComponent(serverId)}&terminalId=${encodeURIComponent(terminalId)}`);

        wsRef.current = ws;

        // WebSocket event handlers
        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          setError(null);
          setTimeout(() => xterm?.focus(), 100);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'output' && xterm) {
              // Write output directly to preserve exact terminal state
              xterm.write(message.data);
            } else if (message.type === 'status' && xterm) {
              // Status messages (like connection status) - don't write to terminal
              console.log('Terminal status:', message.data);
            } else if (message.type === 'exit' && xterm) {
              xterm.writeln(`\r\n\x1b[31mTerminal session ended (code: ${message.code})\x1b[0m\r\n`);
            } else if (message.type === 'error' && xterm) {
              xterm.writeln(`\r\n\x1b[31mError: ${message.message}\x1b[0m\r\n`);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setError('Connection error');
          if (xterm) {
            xterm.writeln('\r\n\x1b[31mConnection error\x1b[0m\r\n');
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          if (xterm) {
            xterm.writeln('\r\n\x1b[31mConnection closed\x1b[0m\r\n');
          }
        };

        // Handle terminal input
        xterm.onData((data: string) => {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });

        // Handle window resize
        const handleResize = () => {
          if (fitAddon && isMounted) {
            try {
              fitAddon.fit();
            } catch (err) {
              // Ignore resize errors
            }
          }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close();
          }
          if (xterm) {
            xterm.dispose();
          }
        };
      } catch (err) {
        console.error('Error initializing terminal:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize terminal');
        }
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [serverId, terminalId, token, onCommandReady]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ height: '100%' }}
        tabIndex={0}
        onClick={() => xtermRef.current?.focus()}
      />
      {!isConnected && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Connecting to terminal...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-destructive mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
