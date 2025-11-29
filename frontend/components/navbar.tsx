'use client'

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  LogOut,
  Activity,
  Terminal,
  Cpu,
  HardDrive,
  Network,
  FileText,
  BarChart3,
  Asterisk,
  Server,
  User,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { removeToken, getToken } from '@/lib/auth';
import { toast } from 'sonner';
import { checkForUpdates, updateComponent, getVersion } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const navItems: Array<{
  icon: any;
  label: string;
  href: string | ((pathname: string) => string);
  matchPattern?: (path: string) => boolean;
}> = [
  {
    icon: Home,
    label: 'Home',
    href: '/',
  },
  {
    icon: Activity,
    label: 'System Monitor',
    href: (pathname: string) => {
      const serverMatch = pathname?.match(/\/server\/([^/]+)/);
      return serverMatch ? `/server/${serverMatch[1]}` : '/server/root';
    },
    matchPattern: (path: string) => path?.startsWith('/server/') && !path?.includes('/cpu') && !path?.includes('/storage') && !path?.includes('/network') && !path?.includes('/analytics') && !path?.includes('/terminal') && !path?.includes('/logs') && !path?.includes('/settings'),
  },
  {
    icon: Cpu,
    label: 'CPU',
    href: (pathname: string) => {
      const serverMatch = pathname?.match(/\/server\/([^/]+)/);
      return serverMatch ? `/server/${serverMatch[1]}/cpu` : '/server/root/cpu';
    },
    matchPattern: (path: string) => path?.includes('/cpu'),
  },
  {
    icon: HardDrive,
    label: 'Storage',
    href: (pathname: string) => {
      const serverMatch = pathname?.match(/\/server\/([^/]+)/);
      return serverMatch ? `/server/${serverMatch[1]}/storage` : '/server/root/storage';
    },
    matchPattern: (path: string) => path?.includes('/storage'),
  },
  {
    icon: Network,
    label: 'Network',
    href: (pathname: string) => {
      const serverMatch = pathname?.match(/\/server\/([^/]+)/);
      return serverMatch ? `/server/${serverMatch[1]}/network` : '/server/root/network';
    },
    matchPattern: (path: string) => path?.includes('/network'),
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    href: (pathname: string) => {
      const serverMatch = pathname?.match(/\/server\/([^/]+)/);
      return serverMatch ? `/server/${serverMatch[1]}/analytics` : '/server/root/analytics';
    },
    matchPattern: (path: string) => path?.includes('/analytics'),
  },
  {
    icon: Terminal,
    label: 'Terminal',
    href: (pathname: string) => {
      const serverMatch = pathname?.match(/\/server\/([^/]+)/);
      return serverMatch ? `/server/${serverMatch[1]}/terminal` : '/server/root/terminal';
    },
    matchPattern: (path: string) => path?.includes('/terminal'),
  },
  {
    icon: FileText,
    label: 'Logs',
    href: (pathname: string) => {
      const serverMatch = pathname?.match(/\/server\/([^/]+)/);
      return serverMatch ? `/server/${serverMatch[1]}/logs` : '/server/root/logs';
    },
    matchPattern: (path: string) => path?.includes('/logs'),
  },
  {
    icon: User,
    label: 'Profile',
    href: '/profile',
  },
];

const homeNavItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Server, label: 'Servers', href: '/servers' },
  { icon: User, label: 'Profile', href: '/profile' },
  { icon: Shield, label: 'Admin', href: '/admin' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasUpdates, setHasUpdates] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ commit: string; branch: string; message?: string } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    backend: {
      hasUpdate: boolean;
      currentCommit: string | null;
      currentMessage?: string | null;
      remoteCommit: string | null;
      remoteMessage?: string | null;
    };
    frontend: {
      hasUpdate: boolean;
      currentCommit: string | null;
      currentMessage?: string | null;
      remoteCommit: string | null;
      remoteMessage?: string | null;
    };
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) return;

      try {
        setIsCheckingUpdates(true);
        const [updates, version] = await Promise.all([checkForUpdates(token), getVersion(token)]);
        const backendHas = updates.updates.backend.hasUpdate;
        const frontendHas = updates.updates.frontend.hasUpdate;
        setHasUpdates(backendHas || frontendHas);
        setUpdateInfo(updates.updates);
        setVersionInfo(version.version);
      } catch (error) {
        console.error('Failed to check for updates from navbar:', error);
      } finally {
        setIsCheckingUpdates(false);
      }
    };

    init();
  }, []);

  const handleLogout = () => {
    removeToken();
    toast.success('Logged out successfully');
    router.push('/login');
    router.refresh();
  };

  return (
    <TooltipProvider>
      <nav className="fixed left-0 top-0 h-screen w-16 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col items-center z-50">
        <div className="pt-4 pb-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/"
                className="flex items-center justify-center w-12 h-12 rounded-lg text-foreground"
              >
                <Asterisk className="w-10 h-10" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>OpenCore</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          {(pathname === '/' || pathname === '/servers' || pathname === '/profile' 
            ? homeNavItems 
            : navItems
          ).map((item) => {
                  const Icon = item.icon;
                  const href = typeof item.href === 'function' ? item.href(pathname || '') : item.href;
                  const isActive = pathname === href || ('matchPattern' in item && typeof item.matchPattern === 'function' && item.matchPattern(pathname || ''));

                  return (
                    <Tooltip key={typeof href === 'string' ? href : item.label}>
                      <TooltipTrigger asChild>
                        <Link
                          href={href}
                          className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
        
        <div className="flex flex-col items-center space-y-2 pb-4">
          {hasUpdates && updateInfo && (
            <Tooltip>
              <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <button
                      className="flex items-center justify-center w-12 h-12 rounded-lg transition-colors bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                      aria-label="Update available"
                    >
                      <RefreshCw className={`w-5 h-5 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                    </button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Update available</p>
                </TooltipContent>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Available</DialogTitle>
                    <DialogDescription>
                      A newer version of OpenCore is available from GitHub. Updating will pull the latest code and rebuild the
                      frontend.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 text-sm">
                    {versionInfo && (
                      <div className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Current version</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {versionInfo.commit.substring(0, 7)}
                          </Badge>
                        </div>
                        {versionInfo.message && (
                          <p className="text-xs text-muted-foreground">{versionInfo.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">Branch: {versionInfo.branch}</p>
                      </div>
                    )}

                    <div className="rounded-md border p-3 space-y-2">
                      {updateInfo.backend.hasUpdate && (
                        <div>
                          <p className="font-medium text-sm mb-1">Backend</p>
                          <p className="text-xs text-muted-foreground">
                            From{' '}
                            <span className="font-mono">
                              {updateInfo.backend.currentCommit?.substring(0, 7) || 'unknown'}
                            </span>{' '}
                            to{' '}
                            <span className="font-mono">
                              {updateInfo.backend.remoteCommit?.substring(0, 7) || 'unknown'}
                            </span>
                          </p>
                          {updateInfo.backend.remoteMessage && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Latest commit: {updateInfo.backend.remoteMessage}
                            </p>
                          )}
                        </div>
                      )}

                      {updateInfo.frontend.hasUpdate && (
                        <div className="mt-2">
                          <p className="font-medium text-sm mb-1">Frontend</p>
                          <p className="text-xs text-muted-foreground">
                            From{' '}
                            <span className="font-mono">
                              {updateInfo.frontend.currentCommit?.substring(0, 7) || 'unknown'}
                            </span>{' '}
                            to{' '}
                            <span className="font-mono">
                              {updateInfo.frontend.remoteCommit?.substring(0, 7) || 'unknown'}
                            </span>
                          </p>
                          {updateInfo.frontend.remoteMessage && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Latest commit: {updateInfo.frontend.remoteMessage}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Note: This will pull from the configured <span className="font-mono">origin/main</span> and may take a few
                      minutes. Any local changes in the repository may cause the update to fail.
                    </p>
                  </div>

                  <DialogFooter className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUpdateDialogOpen(false)}
                      disabled={isUpdating}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const token = getToken();
                        if (!token) {
                          toast.error('You must be logged in to update');
                          return;
                        }

                        try {
                          setIsUpdating(true);
                          toast.info('Updating backend and frontend...');
                          const data = await updateComponent(token, 'both');

                          if (data.success) {
                            toast.success('Update completed. Reloading the app...');
                            setUpdateDialogOpen(false);
                            // Simple refresh to load new frontend build; backend reload depends on how it is run
                            setTimeout(() => {
                              window.location.reload();
                            }, 1500);
                          } else {
                            toast.error('Update failed. See logs for details.');
                          }
                        } catch (error) {
                          toast.error(
                            `Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`,
                          );
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Updating...' : 'Update & Reload'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-12 h-12 rounded-lg transition-colors hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Logout</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
