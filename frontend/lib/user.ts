'use client'

import { getToken } from './auth';

export function getUserFromToken(): { username: string; role: string } | null {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      username: payload.username,
      role: payload.role
    };
  } catch {
    return null;
  }
}

