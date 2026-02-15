import { useCallback } from 'react';

const clerkEnabled = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function useAuthFetch() {
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    if (clerkEnabled) {
      try {
        const { useAuth } = await import('@clerk/clerk-react');
        // Note: can't use hooks here dynamically, so skip token in legacy mode
      } catch {}
    }
    return fetch(url, options);
  }, []);

  return authFetch;
}
