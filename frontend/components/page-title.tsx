'use client'

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/monitor': 'System Monitor',
  '/cpu': 'CPU',
  '/storage': 'Storage',
  '/network': 'Network',
  '/analytics': 'Analytics',
  '/terminal': 'Terminal',
  '/logs': 'Logs',
  '/settings': 'Settings',
};

function getTitleFromPath(pathname: string): string {
  // Check exact matches first
  if (routeTitles[pathname]) {
    return routeTitles[pathname];
  }
  
  // Check for server routes
  if (pathname.includes('/server/')) {
    if (pathname.includes('/cpu')) return 'CPU';
    if (pathname.includes('/storage')) return 'Storage';
    if (pathname.includes('/network')) return 'Network';
    if (pathname.includes('/analytics')) return 'Analytics';
    if (pathname.includes('/terminal')) return 'Terminal';
    if (pathname.includes('/logs')) return 'Logs';
    if (pathname.match(/^\/server\/[^/]+$/)) return 'System Monitor';
  }
  
  return 'OpenCore';
}

export function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const title = getTitleFromPath(pathname);
    document.title = `${title} - OpenCore`;
  }, [pathname]);

  return null;
}

