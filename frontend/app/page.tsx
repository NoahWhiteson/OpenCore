'use client'

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Logo } from '@/components/logo';
import { Navbar } from '@/components/navbar';
import { getUserFromToken } from '@/lib/user';
import { fetchServers } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Activity, Cpu, MemoryStick, HardDrive, Network, Thermometer, Copy, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function HomePage() {
  const user = getUserFromToken();
  const username = user?.username || 'User';
  const router = useRouter();
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadServers() {
      try {
        const token = getToken();
        if (!token) {
          setError('No authentication token found');
          setLoading(false);
          return;
        }

        const data = await fetchServers(token);
        setServers(data.servers || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load servers');
      } finally {
        setLoading(false);
      }
    }

    loadServers();
    const interval = setInterval(loadServers, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

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

  const installCommand = `curl -fsSL https://opencore.install.sh | bash -s -- --hub-url=${typeof window !== 'undefined' ? window.location.origin : 'https://opencore.example.com'} --token=YOUR_TOKEN_HERE`;

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      toast.success('Command copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy command');
    }
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
            <div className="mb-8">
              <p className="text-5xl font-light mb-4 font-sf-pro">Welcome, {username}</p>
              <p className="text-xl text-muted-foreground">
                Manage and monitor your connected servers from a central hub.
          </p>
        </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Connected Servers</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Add Server
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Add New Server</DialogTitle>
                      <DialogDescription>
                        Run this command on your server to install the OpenCore backend and connect it to this hub.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                          <code className="text-foreground">{installCommand}</code>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2 bg-background/95 backdrop-blur-sm hover:bg-background border shadow-sm"
                          onClick={handleCopyCommand}
                        >
                          {copied ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground">Instructions:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Copy the command above</li>
                          <li>SSH into your server</li>
                          <li>Paste and run the command</li>
                          <li>Wait for the installation to complete</li>
                          <li>Your server will appear in the list once connected</li>
                        </ol>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-24 mt-2" />
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
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {servers.map((server) => (
                  <Card key={server.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Server className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-base">{server.name}</CardTitle>
                          {server.type === 'root' && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Root</span>
                          )}
                        </div>
                        <div className={`h-2 w-2 rounded-full ${
                          server.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                      </div>
                      <CardDescription className="text-xs">
                        Last seen: {formatTimeAgo(server.lastSeen)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Cpu className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">CPU</span>
                            </div>
                            <span className="text-sm font-medium">
                              {server.status === 'online' ? `${server.metrics?.cpu?.toFixed(1) || 0}%` : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <MemoryStick className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Memory</span>
                            </div>
                            <span className="text-sm font-medium">
                              {server.status === 'online' ? `${server.metrics?.memory?.toFixed(1) || 0}%` : 'N/A'}
                            </span>
                          </div>
                          {server.metrics?.temperature && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Thermometer className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Temperature</span>
                              </div>
                              <span className="text-sm font-medium">
                                {server.metrics.temperature}°C
                              </span>
                            </div>
                          )}
                        </div>

                        {server.specs && (
                          <div className="pt-3 border-t space-y-2">
                            <div className="text-xs font-semibold text-muted-foreground mb-2">Specifications</div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">CPU:</span>
                                <span className="font-medium">{server.specs.cpu?.brand || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Cores:</span>
                                <span className="font-medium">{server.specs.cpu?.cores || 0} ({server.specs.cpu?.physicalCores || 0} physical)</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Memory:</span>
                                <span className="font-medium">{formatBytes(server.specs.memory?.total || 0)}</span>
                              </div>
                              {server.specs.storage && server.specs.storage.length > 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Storage:</span>
                                  <span className="font-medium">{server.specs.storage.length} drive{server.specs.storage.length > 1 ? 's' : ''}</span>
                                </div>
                              )}
                              {server.specs.network && server.specs.network.length > 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Network:</span>
                                  <span className="font-medium">{server.specs.network.length} interface{server.specs.network.length > 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="pt-2 border-t">
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={server.status === 'offline'}
                            onClick={() => router.push(`/server/${server.id}`)}
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            Connect
                          </Button>
                        </div>
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
