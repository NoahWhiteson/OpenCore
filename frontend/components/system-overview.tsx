'use client'

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchStats, fetchStatsUnencrypted, fetchAllStats } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { decrypt } from '@/lib/decrypt';
import { Cpu, HardDrive, MemoryStick, Activity, Server, Network } from 'lucide-react';
import { Gauge } from '@/components/gauge';
import { MetricChart } from '@/components/metric-chart';

export function SystemOverview() {
  const [loading, setLoading] = useState(true);
  const [systemData, setSystemData] = useState<any>(null);
  const [cpuData, setCpuData] = useState<any>(null);
  const [memoryData, setMemoryData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cpuHistory, setCpuHistory] = useState<Array<{ time: string; value: number }>>([]);
  const [memoryHistory, setMemoryHistory] = useState<Array<{ time: string; value: number }>>([]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    async function loadData() {
      if (!isMounted) return;

      try {
        const token = getToken();
        if (!token) {
          if (isMounted) {
            setError('No authentication token found');
            setLoading(false);
          }
          return;
        }

        const allStats = await fetchAllStats(token);

        if (!isMounted) return;

        setSystemData(allStats);
        setCpuData(allStats.cpu);
        setMemoryData(allStats.memory);

        const now = new Date().toLocaleTimeString();
        const cpuUsage = allStats.cpu?.load?.currentLoad || 0;
        const memUsage = allStats.memory ? ((allStats.memory.used / allStats.memory.total) * 100) : 0;

        setCpuHistory(prev => [...prev.slice(-19), { time: now, value: cpuUsage }]);
        setMemoryHistory(prev => [...prev.slice(-19), { time: now, value: memUsage }]);
        setError(null);
      } catch (err) {
        if (isMounted) {
          console.error('Error loading system data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load system data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    function scheduleNext() {
      if (!isMounted) return;
      
      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        loadData().then(() => {
          if (isMounted) {
            scheduleNext();
          }
        });
      }, 5000);
    }

    loadData().then(() => {
      if (isMounted) {
        scheduleNext();
      }
    });

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const cpuUsage = cpuData?.load?.currentLoad || 0;
  const memoryUsage = memoryData ? ((memoryData.used / memoryData.total) * 100) : 0;
  const memoryUsed = memoryData?.used || 0;
  const memoryTotal = memoryData?.total || 0;
  const memoryAvailable = memoryData?.available || 0;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="md:col-span-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center px-4 pb-4">
          <Gauge value={cpuUsage} label="CPU" />
          <div className="text-center mt-3">
            <p className="text-xs text-muted-foreground">
              {cpuData?.info?.brand || 'CPU'}
            </p>
            <p className="text-xs text-muted-foreground">
              {cpuData?.info?.cores || 0} cores
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          <MemoryStick className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center px-4 pb-4">
          <Gauge value={memoryUsage} label="Memory" />
          <div className="text-center mt-3">
            <p className="text-xs text-muted-foreground">
              {formatBytes(memoryUsed)}
            </p>
            <p className="text-xs text-muted-foreground">
              of {formatBytes(memoryTotal)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base font-medium">CPU Performance</CardTitle>
          <CardDescription className="text-xs">Real-time utilization trends over the last 20 updates</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <MetricChart data={cpuHistory} label="CPU" color="hsl(221, 83%, 53%)" />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base font-medium">Memory Performance</CardTitle>
          <CardDescription className="text-xs">Real-time utilization trends over the last 20 updates</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <MetricChart data={memoryHistory} label="Memory" color="hsl(142, 76%, 36%)" />
        </CardContent>
      </Card>
    </div>
  );
}
