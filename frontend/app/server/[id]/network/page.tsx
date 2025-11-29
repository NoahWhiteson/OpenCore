'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Logo } from '@/components/logo';
import { Navbar } from '@/components/navbar';
import { fetchServers } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Network, Wifi, Globe, Server, Activity } from 'lucide-react';

// Helper function to format bytes
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export default function NetworkPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    async function loadServer() {
      try {
        const token = getToken();
        if (!token) {
          if (isMounted) {
            setError('No authentication token found');
            setLoading(false);
          }
          return;
        }

        const data = await fetchServers(token);
        const foundServer = data.servers?.find((s: any) => s.id === serverId);
        
        if (!foundServer) {
          if (isMounted) {
            setError('Server not found');
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setServer(foundServer);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load server');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
      
      // Update server data every 10 seconds
      if (isMounted) {
        timeoutId = setTimeout(loadServer, 10000);
      }
    }

    loadServer();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [serverId]);

  // Calculate network statistics
  const calculateNetworkStats = () => {
    if (!server?.specs?.network || !Array.isArray(server.specs.network)) {
      return { totalInterfaces: 0, activeInterfaces: 0, hasIPv4: 0, hasIPv6: 0 };
    }

    const networks = server.specs.network;
    return {
      totalInterfaces: networks.length,
      activeInterfaces: networks.filter((n: any) => n.ip).length,
      hasIPv4: networks.filter((n: any) => n.ip && n.ip.includes('.')).length,
      hasIPv6: networks.filter((n: any) => n.ip && n.ip.includes(':')).length,
    };
  };

  const networkStats = calculateNetworkStats();

  return (
    <AuthGuard>
      <div className="min-h-screen flex">
        <Navbar />
        <div className="flex-1 ml-16">
          <div className="p-4">
            <Logo />
          </div>
          <div className="p-6">
            <div className="mb-6">
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
                {loading ? 'Loading...' : server?.name || 'Server'} - Network
              </p>
              <p className="text-xl text-muted-foreground">
                Network interfaces and connection information
              </p>
            </div>

            {loading ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-40 w-full" />
                  </CardContent>
                </Card>
              </div>
            ) : error ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-destructive">Error: {error}</p>
                </CardContent>
              </Card>
            ) : server ? (
              <div className="space-y-6">
                {/* Network Overview Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Interfaces</CardTitle>
                      <Network className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {networkStats.totalInterfaces}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Network interfaces
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Interfaces</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {networkStats.activeInterfaces}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        With IP addresses
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">IPv4 Addresses</CardTitle>
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {networkStats.hasIPv4}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        IPv4 configured
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">IPv6 Addresses</CardTitle>
                      <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {networkStats.hasIPv6}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        IPv6 configured
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Network Interfaces Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Network Interfaces</CardTitle>
                    <CardDescription>Detailed network interface information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {server.specs?.network && server.specs.network.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Interface Name</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>MAC Address</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {server.specs.network.map((net: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {net.name?.toLowerCase().includes('wifi') || net.name?.toLowerCase().includes('wireless') ? (
                                    <Wifi className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Network className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  {net.name || 'Unknown'}
                                </div>
                              </TableCell>
                              <TableCell>
                                {net.ip ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant={net.ip.includes(':') ? 'secondary' : 'default'}>
                                      {net.ip.includes(':') ? 'IPv6' : 'IPv4'}
                                    </Badge>
                                    <span className="font-mono text-sm">{net.ip}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">No IP</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {net.mac ? (
                                  <span className="font-mono text-sm">{net.mac}</span>
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {net.ip ? (
                                  <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground">No network interfaces found.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Network Information */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Network Summary</CardTitle>
                      <CardDescription>Overview of network configuration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Interfaces</span>
                        <span className="font-medium">{networkStats.totalInterfaces}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Active Interfaces</span>
                        <span className="font-medium">{networkStats.activeInterfaces}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">IPv4 Addresses</span>
                        <span className="font-medium">{networkStats.hasIPv4}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">IPv6 Addresses</span>
                        <span className="font-medium">{networkStats.hasIPv6}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Connection Status</CardTitle>
                      <CardDescription>Current network connectivity</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Server Status</span>
                        <Badge variant={server.status === 'online' ? 'default' : 'destructive'}>
                          {server.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Last Seen</span>
                        <span className="font-medium">
                          {server.lastSeen ? new Date(server.lastSeen).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Interfaces with IP</span>
                        <span className="font-medium">
                          {networkStats.activeInterfaces} / {networkStats.totalInterfaces}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Network Ready</span>
                        <Badge variant={networkStats.activeInterfaces > 0 ? 'default' : 'secondary'}>
                          {networkStats.activeInterfaces > 0 ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

