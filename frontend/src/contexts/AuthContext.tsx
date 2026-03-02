import { createContext, useContext, useState, ReactNode } from 'react';

type Role = 'owner' | 'cleaner' | null;
interface AuthCtx {
  role: Role;
  userId: string | null;
  cleanerId: number | null;
  login: (u: string, p: string) => boolean;
  logout: () => void;
  setRole: (r: Role) => void;
  isLoaded: boolean;
}

const AuthContext = createContext<AuthCtx>({
  role: null, userId: null, cleanerId: null, login: () => false, logout: () => {}, setRole: () => {}, isLoaded: false,
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
    // Local dev: check localStorage first, default to 'owner'
    const saved = localStorage.getItem('kozy_role');
    if (saved === 'owner' || saved === 'cleaner') return saved;
    if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) return 'owner';
    return null;
  });

  // cleanerId: maps the logged-in local cleaner user to a DB cleaner record
  // In local dev: cleaner@example.com maps to cleaner id=2 (after seed)
  const [cleanerId, setCleanerId] = useState<number | null>(() => {
    const saved = localStorage.getItem('kozy_cleaner_id');
    return saved ? Number(saved) : null;
  });

  const setRole = (r: Role) => {
    setRoleState(r);
    if (r) localStorage.setItem('kozy_role', r);
    else localStorage.removeItem('kozy_role');
    // Auto-set cleanerId when switching to cleaner role in local dev
    if (r === 'cleaner') {
      // Try dynamic lookup, fall back to cached value
      fetch('/api/cleaners/by-email?email=cleaner%40example.com')
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data?.id) { setCleanerId(data.id); localStorage.setItem('kozy_cleaner_id', String(data.id)); } })
        .catch(() => {});
    } else {
      setCleanerId(null);
      localStorage.removeItem('kozy_cleaner_id');
    }
  };

  const lookupCleanerId = async (email: string) => {
    try {
      const res = await fetch(`/api/cleaners/by-email?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.id) { setCleanerId(data.id); localStorage.setItem('kozy_cleaner_id', String(data.id)); }
      }
    } catch {}
  };

  const login = (u: string, p: string) => {
    const ul = u.toLowerCase().trim();
    const pl = p.toLowerCase().trim();
    if (ul === 'owner@example.com' && pl === 'user') { setRole('owner'); setCleanerId(null); localStorage.removeItem('kozy_cleaner_id'); return true; }
    if (ul === 'cleaner@example.com' && pl === 'user') { setRole('cleaner'); lookupCleanerId('cleaner@example.com'); return true; }
    return false;
  };

  const logout = () => setRole(null);

  return (
    <AuthContext.Provider value={{ role, userId: 'dev-user', cleanerId, login, logout, setRole, isLoaded: true }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
