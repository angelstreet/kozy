import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type Role = 'owner' | 'cleaner' | null;
interface AuthCtx { role: Role; login: (u: string, p: string) => boolean; logout: () => void; setRole: (r: Role) => void; }

const AuthContext = createContext<AuthCtx>({ role: null, login: () => false, logout: () => {}, setRole: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
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
    if (ul === 'owner' && pl === 'owner') { setRole('owner'); return true; }
    if (ul === 'cleaner' && pl === 'cleaner') { setRole('cleaner'); return true; }
    return false;
  };

  const logout = () => setRole(null);

  return <AuthContext.Provider value={{ role, login, logout, setRole }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
