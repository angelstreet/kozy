import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';

type Role = 'owner' | 'cleaner' | null;
interface AuthCtx {
  role: Role;
  userId: string | null;
  login: (u: string, p: string) => boolean;
  logout: () => void;
  setRole: (r: Role) => void;
  isLoaded: boolean;
}

const AuthContext = createContext<AuthCtx>({
  role: null,
  userId: null,
  login: () => false,
  logout: () => {},
  setRole: () => {},
  isLoaded: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded: clerkLoaded, signOut } = useClerkAuth();
  const { user } = useUser();

  const [role, setRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem('kozy_role');
    return (saved === 'owner' || saved === 'cleaner') ? saved : null;
  });

  const userId = user?.id ?? null;

  // Auto-set role from Clerk metadata if available
  useEffect(() => {
    if (user?.publicMetadata?.role) {
      const metaRole = user.publicMetadata.role as string;
      if (metaRole === 'owner' || metaRole === 'cleaner') {
        setRole(metaRole);
      }
    }
  }, [user]);

  const setRole = (r: Role) => {
    setRoleState(r);
    if (r) localStorage.setItem('kozy_role', r);
    else localStorage.removeItem('kozy_role');
  };

  // Legacy login kept for fallback/dev mode
  const login = (u: string, p: string) => {
    const ul = u.toLowerCase().trim();
    const pl = p.toLowerCase().trim();
    if (ul === 'owner' && pl === 'owner') { setRole('owner'); return true; }
    if (ul === 'cleaner' && pl === 'cleaner') { setRole('cleaner'); return true; }
    return false;
  };

  const logout = () => {
    setRole(null);
    if (isSignedIn) signOut();
  };

  // User is authenticated if signed in via Clerk
  const isAuthenticated = clerkLoaded && isSignedIn;

  return (
    <AuthContext.Provider value={{
      role: isAuthenticated ? role : null,
      userId,
      login,
      logout,
      setRole,
      isLoaded: clerkLoaded,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
