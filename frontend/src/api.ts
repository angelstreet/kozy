import { API_BASE } from '@/apiBase';

// Global token getter — set by ClerkTokenProvider
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

/**
 * Authenticated fetch wrapper. Automatically attaches Clerk session token.
 * Drop-in replacement for fetch().
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = new Headers(options.headers);

  if (_getToken) {
    const token = await _getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  // Add local user ID header for dev mode
  const localUserId = localStorage.getItem('kozy_user_id');
  if (localUserId) {
    headers.set('X-Local-User-Id', localUserId);
  }

  return fetch(url, { ...options, headers });
}
