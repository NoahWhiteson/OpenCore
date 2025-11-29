'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Logo } from '@/components/logo';
import { Navbar } from '@/components/navbar';
import { fetchTerminals, createTerminal, deleteTerminal } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Terminal, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const COLOR_OPTIONS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Cyan', value: '#06b6d4' },
];

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const [terminals, setTerminals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTerminalLabel, setNewTerminalLabel] = useState('');
  const [newTerminalColor, setNewTerminalColor] = useState(COLOR_OPTIONS[0].value);
  const [creating, setCreating] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTerminals();
  }, [serverId]);

  async function loadTerminals() {
    try {
      const token = getToken();
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      const data = await fetchTerminals(token, serverId);
      setTerminals(data.terminals || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load terminals');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTerminal() {
    if (!newTerminalLabel.trim()) {
      toast.error('Please enter a terminal label');
      return;
    }

    setCreating(true);
    try {
      const token = getToken();
      if (!token) {
        toast.error('No authentication token found');
        return;
      }

      await createTerminal(token, serverId, newTerminalLabel.trim(), newTerminalColor);
      toast.success('Terminal created successfully');
      setIsCreateDialogOpen(false);
      setNewTerminalLabel('');
      setNewTerminalColor(COLOR_OPTIONS[0].value);
      loadTerminals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create terminal');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteTerminal() {
    if (!deleteTarget) return;

    try {
      const token = getToken();
      if (!token) {
        toast.error('No authentication token found');
        return;
      }

      setDeleting(true);
      await deleteTerminal(token, serverId, deleteTarget.id);
      toast.success('Terminal deleted successfully');
      loadTerminals();
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete terminal');
    } finally {
      setDeleting(false);
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <AuthGuard>
      <div className="min-h-screen flex">
        <Navbar />
        <div className="flex-1 ml-16">
          <div className="p-4">
            <Logo />
          </div>
          <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => router.push(`/server/${serverId}`)}
                  className="mb-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Server
                </Button>
                <p className="text-5xl font-light mb-4 font-sf-pro">
                  Terminals
                </p>
                <p className="text-xl text-muted-foreground">
                  Manage and connect to terminal sessions
                </p>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Add Terminal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Terminal</DialogTitle>
                    <DialogDescription>
                      Create a new terminal session with a custom label and color
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="terminal-label">Terminal Label</Label>
                      <Input
                        id="terminal-label"
                        placeholder="e.g., Production Server, Dev Environment"
                        value={newTerminalLabel}
                        onChange={(e) => setNewTerminalLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateTerminal();
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setNewTerminalColor(color.value)}
                            className={`h-10 w-full rounded-md border-2 transition-all ${
                              newTerminalColor === color.value
                                ? 'border-foreground scale-105'
                                : 'border-border hover:border-foreground/50'
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={handleCreateTerminal} 
                      disabled={creating || !newTerminalLabel.trim()}
                      className="w-full"
                    >
                      {creating ? 'Creating...' : 'Create Terminal'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Dialog
              open={isDeleteDialogOpen}
              onOpenChange={(open) => {
                setIsDeleteDialogOpen(open);
                if (!open) {
                  setDeleteTarget(null);
                  setDeleting(false);
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete terminal</DialogTitle>
                  <DialogDescription>
                    {deleteTarget
                      ? `Are you sure you want to delete the terminal "${deleteTarget.label}"? This action cannot be undone.`
                      : 'Are you sure you want to delete this terminal? This action cannot be undone.'}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteTerminal}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete terminal'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-destructive">Error: {error}</p>
                </CardContent>
              </Card>
            ) : terminals.length === 0 ? (
              <Card>
                <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
                  <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No terminals created</p>
                  <p className="text-sm text-muted-foreground mb-4 text-center">
                    Create your first terminal session to get started
                  </p>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Add Terminal
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Terminal</DialogTitle>
                        <DialogDescription>
                          Create a new terminal session with a custom label and color
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="terminal-label-empty">Terminal Label</Label>
                          <Input
                            id="terminal-label-empty"
                            placeholder="e.g., Production Server, Dev Environment"
                            value={newTerminalLabel}
                            onChange={(e) => setNewTerminalLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCreateTerminal();
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {COLOR_OPTIONS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => setNewTerminalColor(color.value)}
                                className={`h-10 w-full rounded-md border-2 transition-all ${
                                  newTerminalColor === color.value
                                    ? 'border-foreground scale-105'
                                    : 'border-border hover:border-foreground/50'
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              />
                            ))}
                          </div>
                        </div>
                        <Button 
                          onClick={handleCreateTerminal} 
                          disabled={creating || !newTerminalLabel.trim()}
                          className="w-full"
                        >
                          {creating ? 'Creating...' : 'Create Terminal'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {terminals.map((terminal) => (
                  <Card key={terminal.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Terminal className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-base">{terminal.label}</CardTitle>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div
                            className="h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: terminal.color }}
                            title={`Color: ${COLOR_OPTIONS.find(c => c.value === terminal.color)?.name || 'Custom'}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteTarget({ id: terminal.id, label: terminal.label });
                              setIsDeleteDialogOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Terminal ID:</span>
                          <span className="font-mono font-medium">#{terminal.id}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Created:</span>
                          <span>{formatTimeAgo(terminal.created_at)}</span>
                        </div>
                        {terminal.updated_at && terminal.updated_at !== terminal.created_at && (
                          <div className="flex items-center justify-between">
                            <span>Updated:</span>
                            <span>{formatTimeAgo(terminal.updated_at)}</span>
                          </div>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded-md">
                          <span className="text-muted-foreground">Status:</span>
                          <div className="flex items-center space-x-1.5">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="font-medium text-green-600 dark:text-green-400">Ready</span>
                          </div>
                        </div>
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => router.push(`/server/${serverId}/terminal/${terminal.id}`)}
                        >
                          <Terminal className="h-4 w-4 mr-2" />
                          Connect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

