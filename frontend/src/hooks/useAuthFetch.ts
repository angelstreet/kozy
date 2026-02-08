import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';

/**
 * Returns a fetch wrapper that automatically includes the Clerk session token.
 * Use this instead of raw fetch() for all API calls.
 */
export function useAuthFetch() {
  const { getToken } = useAuth();

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  }, [getToken]);

  return authFetch;
}
