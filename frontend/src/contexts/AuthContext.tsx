import { createContext, useContext, useState, ReactNode } from 'react';

type Role = 'owner' | 'cleaner' | null;
interface AuthCtx { role: Role; login: (u: string, p: string) => boolean; logout: () => void; }

const AuthContext = createContext<AuthCtx>({ role: null, login: () => false, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const login = (u: string, p: string) => {
    if (u === 'owner' && p === 'owner') { setRole('owner'); return true; }
    if (u === 'cleaner' && p === 'cleaner') { setRole('cleaner'); return true; }
    return false;
  };
  const logout = () => setRole(null);
  return <AuthContext.Provider value={{ role, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
