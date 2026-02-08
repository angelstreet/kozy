import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setTokenGetter } from '@/api';

/**
 * Invisible component that wires Clerk's getToken into the global apiFetch.
 * Place inside ClerkProvider, before any API-calling components.
 */
export default function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  return <>{children}</>;
}
