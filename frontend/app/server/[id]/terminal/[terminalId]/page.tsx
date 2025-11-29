'use client'

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Logo } from '@/components/logo';
import { Navbar } from '@/components/navbar';
import { Terminal as TerminalComponent } from '@/components/terminal';
import { fetchTerminals } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Send, Power, RotateCw, Settings, Play } from 'lucide-react';
import { toast } from 'sonner';
import { killTerminalSession, restartTerminalSession, updateTerminalStartupCommands } from '@/lib/api';

export default function TerminalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const terminalId = params.terminalId as string;
  
  const [terminal, setTerminal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [sendCommand, setSendCommand] = useState<((cmd: string) => void) | null>(null);
  const [startupCommands, setStartupCommands] = useState('');
  const [showStartupDialog, setShowStartupDialog] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    async function loadTerminal() {
      try {
        const token = getToken();
        if (!token) {
          setError('No authentication token found');
          setLoading(false);
          return;
        }

        const data = await fetchTerminals(token, serverId);
        const foundTerminal = data.terminals?.find((t: any) => t.id === parseInt(terminalId));
        
        if (!foundTerminal) {
          setError('Terminal not found');
          setLoading(false);
          return;
        }

        setTerminal(foundTerminal);
        setStartupCommands(foundTerminal.startup_commands || '');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load terminal');
      } finally {
        setLoading(false);
      }
    }

    if (serverId && terminalId) {
      loadTerminal();
    }
  }, [serverId, terminalId]);

  const handleCommandReady = useCallback((sendFn: (cmd: string) => void) => {
    setSendCommand(() => sendFn);
  }, []);

  const handleSendCommand = () => {
    if (!sendCommand) return;
    if (command.length === 0) return;

    try {
      sendCommand(command);
      setCommand('');
    } catch (err) {
      console.error('Failed to send command:', err);
    }
  };

  const handleKillTerminal = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error('No authentication token found');
        return;
      }

      await killTerminalSession(token, serverId, parseInt(terminalId));
      toast.success('Terminal session killed');
      // Reload the page to reconnect
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to kill terminal');
    }
  };

  const handleRestartTerminal = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error('No authentication token found');
        return;
      }

      setIsRestarting(true);
      await restartTerminalSession(token, serverId, parseInt(terminalId), startupCommands || undefined);
      toast.success('Terminal session restarted');
      // Reload the page to reconnect
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restart terminal');
      setIsRestarting(false);
    }
  };

  const handleSaveStartupCommands = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error('No authentication token found');
        return;
      }

      await updateTerminalStartupCommands(token, serverId, parseInt(terminalId), startupCommands);
      toast.success('Startup commands saved');
      setShowStartupDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save startup commands');
    }
  };

  const handleStartTerminal = async () => {
    if (!startupCommands.trim()) {
      toast.error('Please set startup commands first');
      setShowStartupDialog(true);
      return;
    }

    await handleRestartTerminal();
  };

  return (
    <AuthGuard>
      <div className="min-h-screen flex">
        <Navbar />
        <div className="flex-1 ml-16">
          <div className="p-4">
            <Logo />
          </div>
          <div className="p-6 flex flex-col h-[calc(100vh-80px)]">
            <div className="mb-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push(`/server/${serverId}/terminal`)}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Terminals
              </Button>
              <div className="flex items-center gap-3 mb-2">
                {terminal && (
                  <div
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: terminal.color }}
                  />
                )}
                <p className="text-5xl font-light font-sf-pro">
                  {loading ? 'Loading...' : terminal?.label || 'Terminal'}
                </p>
              </div>
              <p className="text-xl text-muted-foreground">
                Terminal session interface
              </p>
            </div>

            {loading ? (
              <div className="flex-1">
                <Skeleton className="h-full w-full rounded-lg" />
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center rounded-lg border bg-background">
                <p className="text-destructive">Error: {error}</p>
              </div>
            ) : terminal ? (
              <div className="flex-1 flex flex-col rounded-lg overflow-hidden border bg-background min-h-0">
                <div className="flex items-center justify-end gap-2 p-3 border-b bg-muted/30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleKillTerminal}
                    className="gap-2"
                  >
                    <Power className="h-4 w-4" />
                    Kill
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestartTerminal}
                    disabled={isRestarting}
                    className="gap-2"
                  >
                    <RotateCw className={`h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`} />
                    Restart
                  </Button>
                  <Dialog open={showStartupDialog} onOpenChange={setShowStartupDialog}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Startup
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Startup Commands</DialogTitle>
                        <DialogDescription>
                          Commands to run automatically when the terminal starts. One command per line.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="startup-commands">Commands</Label>
                          <Textarea
                            id="startup-commands"
                            value={startupCommands}
                            onChange={(e) => setStartupCommands(e.target.value)}
                            placeholder="cd C:\Users\noahw\Downloads&#10;dir&#10;echo Hello World"
                            className="font-mono text-sm min-h-[200px]"
                          />
                          <p className="text-xs text-muted-foreground">
                            Each line will be executed sequentially with a 500ms delay between commands.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowStartupDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveStartupCommands}>
                          Save Commands
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleStartTerminal}
                    disabled={isRestarting}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start
                  </Button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <TerminalComponent 
                    serverId={serverId} 
                    terminalId={terminalId} 
                    token={getToken() || ''}
                    onCommandReady={handleCommandReady}
                  />
                </div>
                <div className="border-t bg-muted/30 px-4 py-3 flex items-center gap-2 shrink-0">
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-sm text-muted-foreground font-mono shrink-0">$</span>
                    <Input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendCommand();
                        }
                      }}
                      placeholder={sendCommand ? "Type a command and press Enter..." : "Connecting..."}
                      className="flex-1 font-mono text-sm border-0 bg-transparent focus-visible:ring-0 min-w-0"
                      disabled={!sendCommand}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSendCommand}
                    disabled={command.length === 0 || !sendCommand}
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
