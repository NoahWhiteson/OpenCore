import { getApiBaseUrl } from './url-utils';

const API_BASE_URL = getApiBaseUrl();

export interface LoginResponse {
  token: string;
  expiresIn: string;
  user: {
    username: string;
    role: string;
  };
}

export interface EncryptedResponse {
  data: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Login failed' };
    }
    throw new Error(error.error || 'Login failed');
  }

  return response.json();
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchStats(endpoint: string, token: string): Promise<EncryptedResponse> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to fetch stats' };
    }
    throw new Error(error.error || 'Failed to fetch stats');
  }

  return response.json();
}

export async function fetchStatsUnencrypted(endpoint: string, token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to fetch stats' };
    }
    throw new Error(error.error || 'Failed to fetch stats');
  }

  return response.json();
}

export async function fetchAllStats(token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/stats-combined/all`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to fetch stats' };
    }
    throw new Error(error.error || 'Failed to fetch stats');
  }

  return response.json();
}

export async function fetchServers(token: string): Promise<{ servers: any[]; total: number }> {
  const response = await fetch(`${API_BASE_URL}/api/servers`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to fetch servers' };
    }
    throw new Error(error.error || 'Failed to fetch servers');
  }

  return response.json();
}

export async function fetchMetrics(token: string, serverId: string, startDate?: string, endDate?: string, limit?: number): Promise<{ metrics: any[] }> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (limit) params.append('limit', limit.toString());

  const url = `${API_BASE_URL}/api/metrics/${serverId}${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to fetch metrics' };
    }
    throw new Error(error.error || 'Failed to fetch metrics');
  }

  return response.json();
}

export async function fetchTerminals(token: string, serverId: string): Promise<{ terminals: any[] }> {
  const response = await fetch(`${API_BASE_URL}/api/terminals/${serverId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to fetch terminals' };
    }
    throw new Error(error.error || 'Failed to fetch terminals');
  }

  return response.json();
}

export async function createTerminal(token: string, serverId: string, label: string, color: string): Promise<{ terminal: any }> {
  const response = await fetch(`${API_BASE_URL}/api/terminals/${serverId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label, color }),
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to create terminal' };
    }
    throw new Error(error.error || 'Failed to create terminal');
  }

  return response.json();
}

export async function deleteTerminal(token: string, serverId: string, terminalId: number): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/terminals/${serverId}/${terminalId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to delete terminal' };
    }
    throw new Error(error.error || 'Failed to delete terminal');
  }

  return response.json();
}

export async function updateTerminalStartupCommands(token: string, serverId: string, terminalId: number, startupCommands: string): Promise<{ terminal: any }> {
  const response = await fetch(`${API_BASE_URL}/api/terminals/${serverId}/${terminalId}/startup`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ startupCommands }),
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to update startup commands' };
    }
    throw new Error(error.error || 'Failed to update startup commands');
  }

  return response.json();
}

export async function killTerminalSession(token: string, serverId: string, terminalId: number): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/terminals/${serverId}/${terminalId}/kill`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to kill terminal session' };
    }
    throw new Error(error.error || 'Failed to kill terminal session');
  }

  return response.json();
}

export async function restartTerminalSession(token: string, serverId: string, terminalId: number, startupCommands?: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/terminals/${serverId}/${terminalId}/restart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ startupCommands }),
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Failed to restart terminal session' };
    }
    throw new Error(error.error || 'Failed to restart terminal session');
  }

  return response.json();
}

