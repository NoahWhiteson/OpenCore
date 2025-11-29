'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, isAuthenticated } from '@/lib/auth';
import { verifyToken } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }

      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const valid = await verifyToken(token);
      if (!valid) {
        router.push('/login');
        return;
      }

      setIsValid(true);
      setIsChecking(false);
    }

    checkAuth();
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  if (!isValid) {
    return null;
  }

  return <>{children}</>;
}

