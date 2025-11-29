'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Logo } from '@/components/logo';
import { Navbar } from '@/components/navbar';
import { fetchServers, fetchMetrics } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Cpu, Activity, TrendingUp, Thermometer, Zap, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CpuPage() {
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
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load server');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
      
      // Update server data every 10 seconds (less frequent since we're showing historical data)
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
        const formatted = data.metrics.map((m: any) => ({
          time: new Date(m.timestamp).toLocaleString(),
          value: m.cpu_usage || 0,
        }));
        setHistoricalData(formatted);
      } catch (err) {
        console.error('Error loading historical data:', err);
        setHistoricalData([]);
      } finally {
        setLoadingHistorical(false);
      }
    }

    loadHistoricalData();
  }, [serverId, startDate, endDate]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
                {loading ? 'Loading...' : server?.name || 'Server'} - CPU
              </p>
              <p className="text-xl text-muted-foreground">
                CPU performance metrics and statistics
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
                {/* CPU Overview Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {server.metrics?.cpu?.toFixed(1) || 0}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Current load
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">CPU Brand</CardTitle>
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {server.specs?.cpu?.brand || 'Unknown'}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Processor model
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Cores</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {server.specs?.cpu?.cores || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {server.specs?.cpu?.physicalCores || 0} physical cores
                      </p>
                    </CardContent>
                  </Card>

                  {server.metrics?.temperature ? (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Temperature</CardTitle>
                        <Thermometer className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {server.metrics.temperature}°C
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          CPU temperature
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">CPU Speed</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {server.specs?.cpu?.speed || 0} MHz
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Base frequency
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Date Filter */}
                <Card>
                  <CardHeader>
                    <CardTitle>Historical Data Filter</CardTitle>
                    <CardDescription>Filter CPU usage by date range</CardDescription>
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

                {/* CPU Usage Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>CPU Usage Over Time</CardTitle>
                    <CardDescription>
                      {startDate && endDate 
                        ? `CPU utilization from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
                        : 'Last 24 hours of CPU utilization'}
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
                            <linearGradient id="colorCpuHistorical" x1="0" y1="0" x2="0" y2="1">
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
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="hsl(var(--primary))" 
                            fillOpacity={1} 
                            fill="url(#colorCpuHistorical)" 
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

                {/* CPU Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>CPU Specifications</CardTitle>
                      <CardDescription>Detailed processor information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Brand</span>
                        <span className="font-medium">{server.specs?.cpu?.brand || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Cores</span>
                        <span className="font-medium">{server.specs?.cpu?.cores || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Physical Cores</span>
                        <span className="font-medium">{server.specs?.cpu?.physicalCores || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Speed</span>
                        <span className="font-medium">{server.specs?.cpu?.speed || 0} MHz</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Metrics</CardTitle>
                      <CardDescription>Current CPU performance data</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current Usage</span>
                        <span className="font-medium">{server.metrics?.cpu?.toFixed(2) || 0}%</span>
                      </div>
                      {server.metrics?.temperature && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Temperature</span>
                          <span className="font-medium">{server.metrics.temperature}°C</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cores Available</span>
                        <span className="font-medium">{server.specs?.cpu?.cores || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`font-medium ${server.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                          {server.status}
                        </span>
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

