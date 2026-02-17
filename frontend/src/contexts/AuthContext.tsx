import { createContext, useContext, useState, ReactNode } from 'react';

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
  role: null, userId: null, login: () => false, logout: () => {}, setRole: () => {}, isLoaded: false,
});

let clerkAuth: any = null;
try {
  // Only use Clerk if available and configured
  const clerkMod = await import('@clerk/clerk-react');
  if ((import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY) {
    clerkAuth = clerkMod;
  }
} catch {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    // Local dev (no Clerk): auto-login as owner
    if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) return 'owner';
    const saved = localStorage.getItem('kozy_role');
    return (saved === 'owner' || saved === 'cleaner') ? saved : null;
  });

  const setRole = (r: Role) => {
    setRoleState(r);
    if (r) localStorage.setItem('kozy_role', r);
    else localStorage.removeItem('kozy_role');
  };

  const login = (u: string, p: string) => {
    const ul = u.toLowerCase().trim();
    const pl = p.toLowerCase().trim();
    if (ul === 'owner@example.com' && pl === 'user') { setRole('owner'); return true; }
    if (ul === 'cleaner@example.com' && pl === 'user') { setRole('cleaner'); return true; }
    return false;
  };

  const logout = () => setRole(null);

  return (
    <AuthContext.Provider value={{ role, userId: 'dev-user', login, logout, setRole, isLoaded: true }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
