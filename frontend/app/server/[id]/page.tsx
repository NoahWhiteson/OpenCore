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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Server, ArrowLeft, Cpu, MemoryStick, Thermometer, Activity, RefreshCw, Download, Settings, Power, Trash2, Play, Pause, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    async function loadServer() {
      try {
        const token = getToken();
        if (!token) {
          setError('No authentication token found');
          setLoading(false);
          return;
        }

        const data = await fetchServers(token);
        const foundServer = data.servers?.find((s: any) => s.id === serverId);
        
        if (!foundServer) {
          setError('Server not found');
          setLoading(false);
          return;
        }

        setServer(foundServer);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load server');
      } finally {
        setLoading(false);
      }
    }

    loadServer();
    const interval = setInterval(loadServer, 5000);
    return () => clearInterval(interval);
  }, [serverId]);

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

  const exportPDF = async () => {
    if (!server) {
      toast.error('No server data available');
      return;
    }

    // Open dialog immediately
    setPdfDialogOpen(true);
    setPdfGenerating(true);
    
    // Small delay to ensure dialog renders
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let yPos = 20;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const lineHeight = 7;

      const addPageIfNeeded = () => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }
      };

      // Fetch historical data (last 7 days)
      let historicalMetrics: any[] = [];
      try {
        const token = getToken();
        if (token) {
          const endDate = new Date().toISOString();
          const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const metricsData = await fetchMetrics(token, serverId, startDate, endDate);
          historicalMetrics = metricsData.metrics || [];
        }
      } catch (err) {
        console.error('Error fetching historical data for PDF:', err);
      }

      // Header
      doc.setFontSize(20);
      doc.text('OpenCore System Report', margin, yPos);
      yPos += 10;
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
      yPos += 15;

      // Server Information
      doc.setFontSize(16);
      doc.text('Server Information', margin, yPos);
      yPos += 8;
      doc.setFontSize(10);
      
      addPageIfNeeded();
      doc.text(`Name: ${server.name}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Type: ${server.type}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Status: ${server.status}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Last Seen: ${new Date(server.lastSeen).toLocaleString()}`, margin, yPos);
      yPos += lineHeight;
      
      if (server.runtime) {
        doc.text(`Uptime: ${server.runtime.uptimeFormatted}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Started: ${new Date(server.runtime.startTime).toLocaleString()}`, margin, yPos);
        yPos += lineHeight;
      }
      
      if (server.crashes) {
        doc.text(`Total Crashes: ${server.crashes.total}`, margin, yPos);
        yPos += lineHeight;
        if (server.crashes.lastCrash) {
          doc.text(`Last Crash: ${new Date(server.crashes.lastCrash.timestamp).toLocaleString()}`, margin, yPos);
          yPos += lineHeight;
        }
      }
      yPos += 10;

      // System Specifications
      addPageIfNeeded();
      doc.setFontSize(16);
      doc.text('System Specifications', margin, yPos);
      yPos += 8;
      doc.setFontSize(10);
      
      if (server.specs?.system) {
        addPageIfNeeded();
        doc.text(`Manufacturer: ${server.specs.system.manufacturer || 'Unknown'}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Model: ${server.specs.system.model || 'Unknown'}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Version: ${server.specs.system.version || 'Unknown'}`, margin, yPos);
        yPos += 10;
      }

      // CPU Information
      addPageIfNeeded();
      doc.setFontSize(16);
      doc.text('CPU Information', margin, yPos);
      yPos += 8;
      doc.setFontSize(10);
      
      if (server.specs?.cpu) {
        addPageIfNeeded();
        doc.text(`Brand: ${server.specs.cpu.brand || 'Unknown'}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Cores: ${server.specs.cpu.cores || 0} (${server.specs.cpu.physicalCores || 0} physical)`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Speed: ${server.specs.cpu.speed || 0} MHz`, margin, yPos);
        yPos += 10;
      }

      // Memory Information
      addPageIfNeeded();
      doc.setFontSize(16);
      doc.text('Memory Information', margin, yPos);
      yPos += 8;
      doc.setFontSize(10);
      
      if (server.specs?.memory) {
        addPageIfNeeded();
        doc.text(`Total: ${formatBytes(server.specs.memory.total || 0)}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Used: ${formatBytes(server.specs.memory.used || 0)}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Available: ${formatBytes(server.specs.memory.available || 0)}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Usage: ${server.metrics?.memory?.toFixed(2) || 0}%`, margin, yPos);
        yPos += 10;
      }

      // Current Metrics
      addPageIfNeeded();
      doc.setFontSize(16);
      doc.text('Current Metrics', margin, yPos);
      yPos += 8;
      doc.setFontSize(10);
      
      addPageIfNeeded();
      doc.text(`CPU Usage: ${server.metrics?.cpu?.toFixed(2) || 0}%`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Memory Usage: ${server.metrics?.memory?.toFixed(2) || 0}%`, margin, yPos);
      yPos += lineHeight;
      if (server.metrics?.temperature) {
        doc.text(`Temperature: ${server.metrics.temperature}°C`, margin, yPos);
        yPos += lineHeight;
      }
      yPos += 10;

      // Storage Information
      if (server.specs?.storage && server.specs.storage.length > 0) {
        addPageIfNeeded();
        doc.setFontSize(16);
        doc.text('Storage Information', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        
        server.specs.storage.forEach((drive: any) => {
          addPageIfNeeded();
          doc.text(`Filesystem: ${drive.fs}`, margin, yPos);
          yPos += lineHeight;
          doc.text(`Type: ${drive.type || 'Unknown'}`, margin, yPos);
          yPos += lineHeight;
          doc.text(`Size: ${formatBytes(drive.size || 0)}`, margin, yPos);
          yPos += lineHeight;
          doc.text(`Used: ${formatBytes(drive.used || 0)} (${drive.use || 0}%)`, margin, yPos);
          yPos += lineHeight;
          doc.text(`Available: ${formatBytes(drive.available || 0)}`, margin, yPos);
          yPos += lineHeight;
          if (drive.mount) {
            doc.text(`Mount Point: ${drive.mount}`, margin, yPos);
            yPos += lineHeight;
          }
          yPos += 5;
        });
      }

      // Network Interfaces
      if (server.specs?.network && server.specs.network.length > 0) {
        addPageIfNeeded();
        doc.setFontSize(16);
        doc.text('Network Interfaces', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        
        server.specs.network.forEach((iface: any) => {
          addPageIfNeeded();
          doc.text(`Interface: ${iface.name}`, margin, yPos);
          yPos += lineHeight;
          doc.text(`IP Address: ${iface.ip}`, margin, yPos);
          yPos += lineHeight;
          if (iface.mac) {
            doc.text(`MAC Address: ${iface.mac}`, margin, yPos);
            yPos += lineHeight;
          }
          yPos += 5;
        });
      }

      // Historical Trends
      if (historicalMetrics.length > 0) {
        addPageIfNeeded();
        doc.setFontSize(16);
        doc.text('Historical Trends (Last 7 Days)', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);

        // Calculate averages and trends
        const cpuValues = historicalMetrics.map((m: any) => m.cpu_usage).filter((v: any) => v !== null);
        const memoryValues = historicalMetrics.map((m: any) => m.memory_usage).filter((v: any) => v !== null);
        
        if (cpuValues.length > 0) {
          const avgCpu = cpuValues.reduce((a: number, b: number) => a + b, 0) / cpuValues.length;
          const maxCpu = Math.max(...cpuValues);
          const minCpu = Math.min(...cpuValues);
          
          addPageIfNeeded();
          doc.text(`CPU Usage - Average: ${avgCpu.toFixed(2)}%, Max: ${maxCpu.toFixed(2)}%, Min: ${minCpu.toFixed(2)}%`, margin, yPos);
          yPos += lineHeight;
        }

        if (memoryValues.length > 0) {
          const avgMemory = memoryValues.reduce((a: number, b: number) => a + b, 0) / memoryValues.length;
          const maxMemory = Math.max(...memoryValues);
          const minMemory = Math.min(...memoryValues);
          
          addPageIfNeeded();
          doc.text(`Memory Usage - Average: ${avgMemory.toFixed(2)}%, Max: ${maxMemory.toFixed(2)}%, Min: ${minMemory.toFixed(2)}%`, margin, yPos);
          yPos += lineHeight;
        }

        // Sample data points (first, middle, last)
        if (historicalMetrics.length >= 3) {
          addPageIfNeeded();
          yPos += 5;
          doc.setFontSize(14);
          doc.text('Sample Data Points', margin, yPos);
          yPos += 8;
          doc.setFontSize(10);

          const first = historicalMetrics[0];
          const middle = historicalMetrics[Math.floor(historicalMetrics.length / 2)];
          const last = historicalMetrics[historicalMetrics.length - 1];

          [first, middle, last].forEach((point: any, idx: number) => {
            addPageIfNeeded();
            const labels = ['First', 'Middle', 'Last'];
            doc.text(`${labels[idx]} Record (${new Date(point.timestamp).toLocaleString()}):`, margin, yPos);
            yPos += lineHeight;
            doc.text(`  CPU: ${point.cpu_usage?.toFixed(2) || 'N/A'}%`, margin + 5, yPos);
            yPos += lineHeight;
            doc.text(`  Memory: ${point.memory_usage?.toFixed(2) || 'N/A'}%`, margin + 5, yPos);
            yPos += lineHeight;
            if (point.temperature) {
              doc.text(`  Temperature: ${point.temperature}°C`, margin + 5, yPos);
              yPos += lineHeight;
            }
            yPos += 3;
          });
        }
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, margin, pageHeight - 10);
      }

      // Generate PDF blob
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfBlobUrl(url);
      setPdfGenerating(false);
      toast.success('PDF report generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(`Failed to generate PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPdfDialogOpen(false);
      setPdfGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfBlobUrl) return;
    
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.download = `opencore-report-${server?.name || 'server'}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('PDF downloaded successfully');
  };

  const handleCloseDialog = () => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setPdfDialogOpen(false);
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
                onClick={() => router.push('/')}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Servers
              </Button>
              <p className="text-5xl font-light mb-4 font-sf-pro">
                {loading ? 'Loading...' : server?.name || 'Server'}
              </p>
              <p className="text-xl text-muted-foreground">
                Detailed system monitoring and statistics
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Status</CardTitle>
                      <div className={`h-2 w-2 rounded-full ${
                        server.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold capitalize">{server.status}</div>
                      <p className="text-xs text-muted-foreground">
                        Last seen: {formatTimeAgo(server.lastSeen)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {server.metrics?.cpu?.toFixed(1) || 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {server.specs?.cpu?.brand || 'Unknown CPU'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                      <MemoryStick className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {server.metrics?.memory?.toFixed(1) || 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(server.specs?.memory?.used || 0)} / {formatBytes(server.specs?.memory?.total || 0)}
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
                        <div className="text-2xl font-bold">{server.metrics.temperature}°C</div>
                        <p className="text-xs text-muted-foreground">CPU temperature</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast.info('Refreshing data...')}>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Refresh
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportPDF}>
                            <Download className="h-3 w-3 mr-1" />
                            Export
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast.info('Opening settings...')}>
                            <Settings className="h-3 w-3 mr-1" />
                            Settings
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast.info('Viewing logs...')}>
                            <Activity className="h-3 w-3 mr-1" />
                            Logs
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>System Information</CardTitle>
                      <CardDescription>Hardware and system details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Manufacturer</span>
                        <span className="font-medium">{server.specs?.system?.manufacturer || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Model</span>
                        <span className="font-medium">{server.specs?.system?.model || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CPU</span>
                        <span className="font-medium">{server.specs?.cpu?.brand || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cores</span>
                        <span className="font-medium">
                          {server.specs?.cpu?.cores || 0} ({server.specs?.cpu?.physicalCores || 0} physical)
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Memory</span>
                        <span className="font-medium">{formatBytes(server.specs?.memory?.total || 0)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Storage</CardTitle>
                      <CardDescription>Disk usage and storage information</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {server.specs?.storage && server.specs.storage.length > 0 ? (
                        <div className="space-y-3">
                          {server.specs.storage.map((drive: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">{drive.fs}</span>
                                <span className="text-muted-foreground">{drive.use}%</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-500"
                                  style={{ width: `${drive.use}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{formatBytes(drive.used)}</span>
                                <span>{formatBytes(drive.available)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No storage information available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {server.specs?.network && server.specs.network.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Network Interfaces</CardTitle>
                      <CardDescription>Network configuration and IP addresses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {server.specs.network.map((iface: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-start text-sm">
                            <div>
                              <p className="font-medium">{iface.name}</p>
                              <p className="text-xs text-muted-foreground">{iface.ip}</p>
                              {iface.mac && (
                                <p className="text-xs text-muted-foreground">{iface.mac}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={pdfDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>System Report PDF</DialogTitle>
            <DialogDescription>
              Preview and download your system report
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[500px] border rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
            {pdfGenerating ? (
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Generating PDF report...</p>
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                className="w-full h-full min-h-[500px] border-0"
                title="PDF Report Preview"
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-muted-foreground">No PDF available</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCloseDialog}>
              Close
            </Button>
            <Button onClick={handleDownloadPDF} disabled={!pdfBlobUrl}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AuthGuard>
  );
}

