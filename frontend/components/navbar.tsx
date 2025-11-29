'use client'

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Settings, LogOut, Activity, Terminal, Cpu, HardDrive, Network, FileText, BarChart3, Asterisk, Server, User, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { removeToken } from '@/lib/auth';
import { toast } from 'sonner';

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
        
        <div className="pb-4">
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
