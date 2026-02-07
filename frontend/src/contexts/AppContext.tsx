import { createContext, useContext, useState, ReactNode } from 'react';

interface AppCtx { lang: string; setLang: (l: string) => void; dark: boolean; toggleDark: () => void; }
const AppContext = createContext<AppCtx>({ lang: 'en', setLang: () => {}, dark: false, toggleDark: () => {} });

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState('en');
  const [dark, setDark] = useState(false);
  const toggleDark = () => setDark(d => {
    document.documentElement.classList.toggle('dark', !d);
    return !d;
  });
  return <AppContext.Provider value={{ lang, setLang, dark, toggleDark }}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
