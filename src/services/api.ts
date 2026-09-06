/**
 * BROMISE API Service
 *
 * Provides a thin wrapper around the Express backend REST API.
 * Used by the sync adapter — not called directly by components.
 */

const BASE = '/api';

export function getStoredToken(): string | null {
  return localStorage.getItem('bromise_token');
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem('bromise_token', token);
  } else {
    localStorage.removeItem('bromise_token');
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 && path !== '/auth/google') {
      // Token expired or invalid — clear token
      setStoredToken(null);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ status: string }>('GET', '/health'),

  // Auth
  googleAuth: (credential: string) => req<{ token: string; user: any }>('POST', '/auth/google', { credential }),
  getMe: () => req<{ user: any }>('GET', '/auth/me'),

  // Categories
  getCategories: () => req<any[]>('GET', '/categories'),
  createCategory: (data: any) => req<any>('POST', '/categories', data),
  updateCategory: (id: string, data: any) => req<any>('PUT', `/categories/${id}`, data),
  deleteCategory: (id: string, body: { action: string; targetCategoryId?: string }) =>
    req<any>('DELETE', `/categories/${id}`, body),

  // Tasks
  getTasks: () => req<any[]>('GET', '/tasks'),
  createTask: (data: any) => req<any>('POST', '/tasks', data),
  updateTask: (id: string, data: any) => req<any>('PUT', `/tasks/${id}`, data),
  deleteTask: (id: string) => req<any>('DELETE', `/tasks/${id}`, {}),

  // Plans
  getPlans: (date?: string) =>
    req<any[]>('GET', date ? `/plans?date=${date}` : '/plans'),
  createPlan: (data: { taskId: string; date: string; position?: number; sourceType?: string }) =>
    req<any>('POST', '/plans', data),
  deletePlan: (id: string) => req<any>('DELETE', `/plans/${id}`),
  reorderPlans: (date: string, orderedTaskIds: string[]) =>
    req<any[]>('PUT', '/plans/reorder', { date, orderedTaskIds }),

  // Completions
  getCompletions: (date?: string) =>
    req<any[]>('GET', date ? `/completions?date=${date}` : '/completions'),
  toggleCompletion: (taskId: string, date: string) =>
    req<any>('POST', '/completions/toggle', { taskId, date }),

  // Stats
  getStats: (date: string) => req<any>('GET', `/stats?date=${date}`),
  getStreak: () => req<any>('GET', '/stats/streak'),
  getHeatmap: (days?: number) =>
    req<any[]>('GET', `/stats/heatmap${days ? `?days=${days}` : ''}`),

  // Export / Import / Reset
  exportData: () => fetch(`${BASE}/export`, { headers: getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {} }).then(r => r.json()),
  importData: (data: any) => req<any>('POST', '/import', data),
  resetSeed: () => req<any>('POST', '/seed/reset', {}),
};
