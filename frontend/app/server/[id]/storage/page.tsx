'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Logo } from '@/components/logo';
import { Navbar } from '@/components/navbar';
import { fetchServers, fetchMetrics } from '@/lib/api';
import { getToken, removeToken } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, HardDrive, Database, TrendingUp, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to format bytes
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export default function StoragePage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<Array<{ time: string; value: number }>>([]);
  
  // Default to last 24 hours (yesterday to today)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const today = new Date();
  
  const [startDate, setStartDate] = useState<string>(formatDate(yesterday));
  const [endDate, setEndDate] = useState<string>(formatDate(today));
  const [loadingHistorical, setLoadingHistorical] = useState(false);

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
        if (!isMounted) return;

        const message = err instanceof Error ? err.message : 'Failed to load server';
        if (message.includes('Invalid or expired token')) {
          removeToken();
          toast.error('Session expired. Please log in again.');
          router.push('/login');
          router.refresh();
          return;
        }

        setError(message);
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

  useEffect(() => {
    async function loadHistoricalData() {
      if (!startDate || !endDate) {
        setHistoricalData([]);
        return;
      }

      setLoadingHistorical(true);
      try {
        const token = getToken();
        if (!token) return;

        const data = await fetchMetrics(token, serverId, startDate, endDate);
        
        // Process storage data from metrics
        const formatted: Array<{ time: string; value: number }> = [];
        
        data.metrics.forEach((m: any) => {
          if (m.storage_data) {
            try {
              const storage = JSON.parse(m.storage_data);
              if (Array.isArray(storage) && storage.length > 0) {
                // Calculate total usage percentage across all filesystems
                let totalSize = 0;
                let totalUsed = 0;
                
                storage.forEach((fs: any) => {
                  if (fs.size && fs.used) {
                    totalSize += fs.size;
                    totalUsed += fs.used;
                  }
                });
                
                if (totalSize > 0) {
                  const usagePercent = (totalUsed / totalSize) * 100;
                  formatted.push({
                    time: new Date(m.timestamp).toLocaleString(),
                    value: Math.round(usagePercent * 100) / 100,
                  });
                }
              }
            } catch (e) {
              // Skip invalid storage data
            }
          }
        });
        
        setHistoricalData(formatted);
      } catch (err) {
        console.error('Error loading historical data:', err);
        const message = err instanceof Error ? err.message : 'Failed to load historical data';

        if (message.includes('Invalid or expired token')) {
          removeToken();
          toast.error('Session expired. Please log in again.');
          router.push('/login');
          router.refresh();
          return;
        }

        setHistoricalData([]);
      } finally {
        setLoadingHistorical(false);
      }
    }

    loadHistoricalData();
  }, [serverId, startDate, endDate]);

  // Calculate total storage metrics
  const calculateStorageTotals = () => {
    if (!server?.specs?.storage || !Array.isArray(server.specs.storage)) {
      return { total: 0, used: 0, available: 0, usagePercent: 0 };
    }

    const totals = server.specs.storage.reduce(
      (acc: any, fs: any) => {
        acc.total += fs.size || 0;
        acc.used += fs.used || 0;
        acc.available += fs.available || 0;
        return acc;
      },
      { total: 0, used: 0, available: 0 }
    );

    const usagePercent = totals.total > 0 ? (totals.used / totals.total) * 100 : 0;

    return {
      total: totals.total,
      used: totals.used,
      available: totals.available,
      usagePercent: Math.round(usagePercent * 100) / 100,
    };
  };

  const storageTotals = calculateStorageTotals();

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
                {loading ? 'Loading...' : server?.name || 'Server'} - Storage
              </p>
              <p className="text-xl text-muted-foreground">
                Storage usage metrics and filesystem information
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
                {/* Storage Overview Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatBytes(storageTotals.total)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Combined capacity
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Used Storage</CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatBytes(storageTotals.used)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {storageTotals.usagePercent.toFixed(1)}% of total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Available Storage</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatBytes(storageTotals.available)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Free space
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Usage</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {storageTotals.usagePercent.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Storage utilization
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Date Filter */}
                <Card>
                  <CardHeader>
                    <CardTitle>Historical Data Filter</CardTitle>
                    <CardDescription>Filter storage usage by date range</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setStartDate(formatDate(yesterday));
                        setEndDate(formatDate(new Date()));
                      }}
                    >
                      Reset to Last 24 Hours
                    </Button>
                  </CardContent>
                </Card>

                {/* Storage Usage Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Storage Usage Over Time</CardTitle>
                    <CardDescription>
                      {startDate && endDate 
                        ? `Storage utilization from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
                        : 'Last 24 hours of storage utilization'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingHistorical ? (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <p>Loading historical data...</p>
                      </div>
                    ) : historicalData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={historicalData}>
                          <defs>
                            <linearGradient id="colorStorageHistorical" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="time" 
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            domain={[0, 100]}
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px'
                            }}
                            formatter={(value: any) => [`${value}%`, 'Usage']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="hsl(var(--primary))" 
                            fillOpacity={1} 
                            fill="url(#colorStorageHistorical)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <p>No data available for the selected date range.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Filesystem Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Filesystems</CardTitle>
                    <CardDescription>Detailed filesystem information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {server.specs?.storage && server.specs.storage.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Filesystem</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Mount Point</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Used</TableHead>
                            <TableHead>Available</TableHead>
                            <TableHead>Usage %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {server.specs.storage.map((fs: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{fs.fs || 'N/A'}</TableCell>
                              <TableCell>{fs.type || 'N/A'}</TableCell>
                              <TableCell>{fs.mount || 'N/A'}</TableCell>
                              <TableCell>{formatBytes(fs.size || 0)}</TableCell>
                              <TableCell>{formatBytes(fs.used || 0)}</TableCell>
                              <TableCell>{formatBytes(fs.available || 0)}</TableCell>
                              <TableCell>
                                <span className={fs.use && fs.use > 80 ? 'text-red-500 font-medium' : fs.use && fs.use > 60 ? 'text-yellow-500 font-medium' : ''}>
                                  {fs.use ? `${fs.use.toFixed(1)}%` : 'N/A'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground">No filesystem information available.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

