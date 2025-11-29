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
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, Activity, Zap, Thermometer, Database, AlertTriangle, CheckCircle, Clock, Target, Gauge, HardDrive, Network, Cpu, MemoryStick, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

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

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<Array<{ 
    time: string; 
    cpu: number; 
    memory: number; 
    temperature: number | null;
    memoryUsed: number;
    memoryTotal: number;
  }>>([]);
  
  // Default to last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const today = new Date();
  
  const [startDate, setStartDate] = useState<string>(formatDate(sevenDaysAgo));
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
        
        const formatted = data.metrics.map((m: any) => ({
          time: new Date(m.timestamp).toLocaleString(),
          cpu: m.cpu_usage || 0,
          memory: m.memory_usage || 0,
          temperature: m.temperature || null,
          memoryUsed: m.memory_used || 0,
          memoryTotal: m.memory_total || 0,
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

  // Calculate comprehensive statistics
  const calculateStats = () => {
    if (historicalData.length === 0) {
      return {
        avgCpu: 0, minCpu: 0, maxCpu: 0, medianCpu: 0, stdDevCpu: 0,
        avgMemory: 0, minMemory: 0, maxMemory: 0, medianMemory: 0, stdDevMemory: 0,
        avgTemperature: 0, minTemperature: 0, maxTemperature: 0, medianTemperature: 0,
        totalDataPoints: 0,
        cpuPercentiles: { p25: 0, p50: 0, p75: 0, p95: 0, p99: 0 },
        memoryPercentiles: { p25: 0, p50: 0, p75: 0, p95: 0, p99: 0 },
        hourlyBreakdown: [] as any[],
        peakHours: { cpu: '', memory: '' },
        utilizationScore: 0,
        healthScore: 0,
        alerts: [] as string[],
      };
    }

    const cpuValues = historicalData.map(d => d.cpu).filter(v => v > 0).sort((a, b) => a - b);
    const memoryValues = historicalData.map(d => d.memory).filter(v => v > 0).sort((a, b) => a - b);
    const tempValues = historicalData.map(d => d.temperature).filter(v => v !== null && v > 0).sort((a, b) => (a || 0) - (b || 0)) as number[];

    const calculatePercentile = (sorted: number[], percentile: number) => {
      if (sorted.length === 0) return 0;
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const calculateStdDev = (values: number[], avg: number) => {
      if (values.length === 0) return 0;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
      return Math.sqrt(variance);
    };

    const calculateMedian = (sorted: number[]) => {
      if (sorted.length === 0) return 0;
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    };

    // Hourly breakdown
    const hourlyData: { [key: number]: { cpu: number[]; memory: number[]; count: number } } = {};
    historicalData.forEach(d => {
      const hour = new Date(d.time).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { cpu: [], memory: [], count: 0 };
      }
      if (d.cpu > 0) hourlyData[hour].cpu.push(d.cpu);
      if (d.memory > 0) hourlyData[hour].memory.push(d.memory);
      hourlyData[hour].count++;
    });

    const hourlyBreakdown = Object.keys(hourlyData).map(hour => ({
      hour: parseInt(hour),
      avgCpu: hourlyData[parseInt(hour)].cpu.length > 0 
        ? hourlyData[parseInt(hour)].cpu.reduce((a, b) => a + b, 0) / hourlyData[parseInt(hour)].cpu.length 
        : 0,
      avgMemory: hourlyData[parseInt(hour)].memory.length > 0
        ? hourlyData[parseInt(hour)].memory.reduce((a, b) => a + b, 0) / hourlyData[parseInt(hour)].memory.length
        : 0,
      count: hourlyData[parseInt(hour)].count,
    })).sort((a, b) => a.hour - b.hour);

    const peakCpuHour = hourlyBreakdown.reduce((max, h) => h.avgCpu > max.avgCpu ? h : max, hourlyBreakdown[0] || { hour: 0, avgCpu: 0 });
    const peakMemoryHour = hourlyBreakdown.reduce((max, h) => h.avgMemory > max.avgMemory ? h : max, hourlyBreakdown[0] || { hour: 0, avgMemory: 0 });

    const avgCpu = cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0;
    const avgMemory = memoryValues.length > 0 ? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length : 0;
    const avgTemperature = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : 0;

    // Health score calculation (0-100)
    const cpuScore = Math.max(0, 100 - (avgCpu * 0.5)); // Lower CPU usage = better
    const memoryScore = Math.max(0, 100 - (avgMemory * 0.5)); // Lower memory usage = better
    const tempScore = tempValues.length > 0 && avgTemperature > 0 
      ? Math.max(0, 100 - ((avgTemperature - 40) * 2)) // Optimal around 40-50°C
      : 50;
    const healthScore = (cpuScore + memoryScore + tempScore) / 3;

    // Utilization score (how well resources are being used)
    const utilizationScore = (avgCpu + avgMemory) / 2;

    // Alerts
    const alerts: string[] = [];
    if (avgCpu > 80) alerts.push('High average CPU usage detected');
    if (avgMemory > 85) alerts.push('High average memory usage detected');
    if (avgTemperature > 80) alerts.push('High CPU temperature detected');
    if (cpuValues.length > 0 && Math.max(...cpuValues) > 95) alerts.push('CPU usage peaked above 95%');
    if (memoryValues.length > 0 && Math.max(...memoryValues) > 95) alerts.push('Memory usage peaked above 95%');

    return {
      avgCpu, minCpu: cpuValues[0] || 0, maxCpu: cpuValues[cpuValues.length - 1] || 0,
      medianCpu: calculateMedian(cpuValues), stdDevCpu: calculateStdDev(cpuValues, avgCpu),
      avgMemory, minMemory: memoryValues[0] || 0, maxMemory: memoryValues[memoryValues.length - 1] || 0,
      medianMemory: calculateMedian(memoryValues), stdDevMemory: calculateStdDev(memoryValues, avgMemory),
      avgTemperature, minTemperature: tempValues[0] || 0, maxTemperature: tempValues[tempValues.length - 1] || 0,
      medianTemperature: calculateMedian(tempValues),
      totalDataPoints: historicalData.length,
      cpuPercentiles: {
        p25: calculatePercentile(cpuValues, 25),
        p50: calculatePercentile(cpuValues, 50),
        p75: calculatePercentile(cpuValues, 75),
        p95: calculatePercentile(cpuValues, 95),
        p99: calculatePercentile(cpuValues, 99),
      },
      memoryPercentiles: {
        p25: calculatePercentile(memoryValues, 25),
        p50: calculatePercentile(memoryValues, 50),
        p75: calculatePercentile(memoryValues, 75),
        p95: calculatePercentile(memoryValues, 95),
        p99: calculatePercentile(memoryValues, 99),
      },
      hourlyBreakdown,
      peakHours: {
        cpu: peakCpuHour ? `${peakCpuHour.hour}:00` : 'N/A',
        memory: peakMemoryHour ? `${peakMemoryHour.hour}:00` : 'N/A',
      },
      utilizationScore,
      healthScore,
      alerts,
    };
  };

  const stats = calculateStats();

  // Storage analytics from historical data
  const calculateStorageStats = () => {
    if (historicalData.length === 0) return null;
    
    const storageData: any[] = [];
    historicalData.forEach(d => {
      // We'd need to parse storage_data from metrics if available
    });

    return {
      totalStorage: server?.specs?.storage?.reduce((sum: number, fs: any) => sum + (fs.size || 0), 0) || 0,
      usedStorage: server?.specs?.storage?.reduce((sum: number, fs: any) => sum + (fs.used || 0), 0) || 0,
      availableStorage: server?.specs?.storage?.reduce((sum: number, fs: any) => sum + (fs.available || 0), 0) || 0,
    };
  };

  const storageStats = calculateStorageStats();

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
                {loading ? 'Loading...' : server?.name || 'Server'} - Analytics
              </p>
              <p className="text-xl text-muted-foreground">
                Comprehensive performance analytics and insights
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
                {/* Alerts */}
                {stats.alerts.length > 0 && (
                  <Card className="border-yellow-500/50 bg-yellow-500/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                        <AlertTriangle className="h-5 w-5" />
                        Performance Alerts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {stats.alerts.map((alert, idx) => (
                          <li key={idx} className="text-sm">{alert}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Health & Utilization Scores */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">System Health Score</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.healthScore.toFixed(1)}/100
                      </div>
                      <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            stats.healthScore >= 80 ? 'bg-green-500' :
                            stats.healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${stats.healthScore}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.healthScore >= 80 ? 'Excellent' :
                         stats.healthScore >= 60 ? 'Good' : 'Needs Attention'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Resource Utilization</CardTitle>
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.utilizationScore.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Average resource usage
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Peak CPU Hour</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.peakHours.cpu}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Highest average usage
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Peak Memory Hour</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.peakHours.memory}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Highest average usage
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg CPU Usage</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.avgCpu.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Min: {stats.minCpu.toFixed(1)}% | Max: {stats.maxCpu.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Memory Usage</CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.avgMemory.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Min: {stats.minMemory.toFixed(1)}% | Max: {stats.maxMemory.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>

                  {stats.avgTemperature > 0 && (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Temperature</CardTitle>
                        <Thermometer className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {stats.avgTemperature.toFixed(1)}°C
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Peak: {stats.maxTemperature.toFixed(1)}°C
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Data Points</CardTitle>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.totalDataPoints}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Records collected
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Date Filter */}
                <Card>
                  <CardHeader>
                    <CardTitle>Date Range Filter</CardTitle>
                    <CardDescription>Select a date range for analytics</CardDescription>
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
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const yesterday = new Date();
                          yesterday.setDate(yesterday.getDate() - 1);
                          setStartDate(formatDate(yesterday));
                          setEndDate(formatDate(new Date()));
                        }}
                      >
                        Last 24 Hours
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const sevenDaysAgo = new Date();
                          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                          setStartDate(formatDate(sevenDaysAgo));
                          setEndDate(formatDate(new Date()));
                        }}
                      >
                        Last 7 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const thirtyDaysAgo = new Date();
                          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                          setStartDate(formatDate(thirtyDaysAgo));
                          setEndDate(formatDate(new Date()));
                        }}
                      >
                        Last 30 Days
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Combined CPU and Memory Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>CPU & Memory Usage</CardTitle>
                    <CardDescription>
                      {startDate && endDate 
                        ? `Performance metrics from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
                        : 'Last 7 days of performance metrics'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingHistorical ? (
                      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                        <p>Loading historical data...</p>
                      </div>
                    ) : historicalData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart 
                          data={historicalData}
                          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="time" 
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            domain={[0, 100]}
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            label={{ value: 'Usage (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px',
                              padding: '8px'
                            }}
                            formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="cpu" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            name="CPU Usage (%)"
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="memory" 
                            stroke="hsl(var(--chart-2))" 
                            strokeWidth={2}
                            name="Memory Usage (%)"
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                        <p>No data available for the selected date range.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Temperature Chart (if available) */}
                {stats.avgTemperature > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>CPU Temperature</CardTitle>
                      <CardDescription>Temperature trends over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingHistorical ? (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          <p>Loading historical data...</p>
                        </div>
                      ) : historicalData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={historicalData.filter(d => d.temperature !== null)}>
                            <defs>
                              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
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
                              className="text-xs"
                              tick={{ fill: 'hsl(var(--muted-foreground))' }}
                              label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px'
                              }}
                              formatter={(value: any) => [`${value}°C`, 'Temperature']}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="temperature" 
                              stroke="hsl(var(--chart-3))" 
                              fillOpacity={1} 
                              fill="url(#colorTemp)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          <p>No temperature data available.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Statistics */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>CPU Statistics</CardTitle>
                      <CardDescription>Comprehensive CPU performance metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="text-lg font-semibold">{stats.avgCpu.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Median</p>
                          <p className="text-lg font-semibold">{stats.medianCpu.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Minimum</p>
                          <p className="text-lg font-semibold">{stats.minCpu.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Maximum</p>
                          <p className="text-lg font-semibold">{stats.maxCpu.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Std Deviation</p>
                          <p className="text-lg font-semibold">{stats.stdDevCpu.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">95th Percentile</p>
                          <p className="text-lg font-semibold">{stats.cpuPercentiles.p95.toFixed(2)}%</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Percentiles</p>
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">P25</p>
                            <p className="font-medium">{stats.cpuPercentiles.p25.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P50</p>
                            <p className="font-medium">{stats.cpuPercentiles.p50.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P75</p>
                            <p className="font-medium">{stats.cpuPercentiles.p75.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P95</p>
                            <p className="font-medium">{stats.cpuPercentiles.p95.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P99</p>
                            <p className="font-medium">{stats.cpuPercentiles.p99.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Memory Statistics</CardTitle>
                      <CardDescription>Comprehensive memory performance metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="text-lg font-semibold">{stats.avgMemory.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Median</p>
                          <p className="text-lg font-semibold">{stats.medianMemory.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Minimum</p>
                          <p className="text-lg font-semibold">{stats.minMemory.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Maximum</p>
                          <p className="text-lg font-semibold">{stats.maxMemory.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Std Deviation</p>
                          <p className="text-lg font-semibold">{stats.stdDevMemory.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">95th Percentile</p>
                          <p className="text-lg font-semibold">{stats.memoryPercentiles.p95.toFixed(2)}%</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Percentiles</p>
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">P25</p>
                            <p className="font-medium">{stats.memoryPercentiles.p25.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P50</p>
                            <p className="font-medium">{stats.memoryPercentiles.p50.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P75</p>
                            <p className="font-medium">{stats.memoryPercentiles.p75.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P95</p>
                            <p className="font-medium">{stats.memoryPercentiles.p95.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P99</p>
                            <p className="font-medium">{stats.memoryPercentiles.p99.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Hourly Breakdown Chart */}
                {stats.hourlyBreakdown.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Hourly Performance Breakdown</CardTitle>
                      <CardDescription>Average usage by hour of day</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart 
                          data={stats.hourlyBreakdown}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="hour" 
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle' } }}
                          />
                          <YAxis 
                            domain={[0, 100]}
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            label={{ value: 'Usage (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px',
                              padding: '8px'
                            }}
                            formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                          />
                          <Legend />
                          <Bar 
                            dataKey="avgCpu" 
                            fill="hsl(var(--primary))" 
                            name="CPU Usage (%)"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar 
                            dataKey="avgMemory" 
                            fill="hsl(var(--chart-2))" 
                            name="Memory Usage (%)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Memory Usage Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Memory Analytics</CardTitle>
                    <CardDescription>Detailed memory usage statistics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historicalData.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Average Memory Used</p>
                          <p className="text-2xl font-bold">
                            {formatBytes(
                              historicalData.reduce((sum, d) => sum + d.memoryUsed, 0) / historicalData.length
                            )}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Peak Memory Used</p>
                          <p className="text-2xl font-bold">
                            {formatBytes(Math.max(...historicalData.map(d => d.memoryUsed)))}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Total Memory</p>
                          <p className="text-2xl font-bold">
                            {historicalData.length > 0 ? formatBytes(historicalData[0].memoryTotal) : 'N/A'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Memory Efficiency</p>
                          <p className="text-2xl font-bold">
                            {stats.avgMemory.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No memory data available.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Storage Analytics */}
                {storageStats && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Storage Analytics</CardTitle>
                      <CardDescription>Storage utilization and capacity</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Total Storage</p>
                          <p className="text-2xl font-bold">
                            {formatBytes(storageStats.totalStorage)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Used Storage</p>
                          <p className="text-2xl font-bold">
                            {formatBytes(storageStats.usedStorage)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {storageStats.totalStorage > 0 
                              ? ((storageStats.usedStorage / storageStats.totalStorage) * 100).toFixed(1) 
                              : 0}% used
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Available Storage</p>
                          <p className="text-2xl font-bold">
                            {formatBytes(storageStats.availableStorage)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* System Information */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>System Specifications</CardTitle>
                      <CardDescription>Hardware and system details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CPU Brand</span>
                        <span className="font-medium">{server.specs?.cpu?.brand || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CPU Cores</span>
                        <span className="font-medium">{server.specs?.cpu?.cores || 0} ({server.specs?.cpu?.physicalCores || 0} physical)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CPU Speed</span>
                        <span className="font-medium">{server.specs?.cpu?.speed || 0} MHz</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Memory</span>
                        <span className="font-medium">{formatBytes(server.specs?.memory?.total || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">System Manufacturer</span>
                        <span className="font-medium">{server.specs?.system?.manufacturer || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">System Model</span>
                        <span className="font-medium">{server.specs?.system?.model || 'Unknown'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Insights</CardTitle>
                      <CardDescription>Key performance indicators and recommendations</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">CPU Stability</span>
                          <span className={`text-sm font-medium ${
                            stats.stdDevCpu < 10 ? 'text-green-500' :
                            stats.stdDevCpu < 20 ? 'text-yellow-500' : 'text-red-500'
                          }`}>
                            {stats.stdDevCpu < 10 ? 'Stable' :
                             stats.stdDevCpu < 20 ? 'Moderate' : 'Variable'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Memory Stability</span>
                          <span className={`text-sm font-medium ${
                            stats.stdDevMemory < 10 ? 'text-green-500' :
                            stats.stdDevMemory < 20 ? 'text-yellow-500' : 'text-red-500'
                          }`}>
                            {stats.stdDevMemory < 10 ? 'Stable' :
                             stats.stdDevMemory < 20 ? 'Moderate' : 'Variable'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Data Collection</span>
                          <span className="text-sm font-medium text-green-500">
                            {stats.totalDataPoints} points collected
                          </span>
                        </div>
                      </div>
                      <div className="pt-3 border-t">
                        <p className="text-xs font-medium mb-2">Recommendations</p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {stats.avgCpu > 70 && (
                            <li>• Consider optimizing CPU-intensive processes</li>
                          )}
                          {stats.avgMemory > 80 && (
                            <li>• Monitor memory usage - consider adding more RAM</li>
                          )}
                          {stats.avgTemperature > 70 && (
                            <li>• Check cooling system - temperature is elevated</li>
                          )}
                          {stats.healthScore < 60 && (
                            <li>• System health needs attention - review all metrics</li>
                          )}
                          {stats.alerts.length === 0 && (
                            <li className="text-green-500">• System performance is within normal parameters</li>
                          )}
                        </ul>
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

