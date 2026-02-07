import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

interface CacheEntry { data: any; ts: number; }
const CACHE_TTL = 5 * 60 * 1000; // 5 min

interface AppCtx {
  lang: string; setLang: (l: string) => void;
  dark: boolean; toggleDark: () => void;
  cache: Record<string, CacheEntry>;
  fetchCached: (url: string, force?: boolean) => Promise<any>;
  invalidateCache: (url: string) => void;
}

const AppContext = createContext<AppCtx>({} as AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('kozy_lang') || 'en');
  const [dark, setDark] = useState(() => localStorage.getItem('kozy_dark') === 'true');
  const cacheRef = useRef<Record<string, CacheEntry>>({});
  const [, setTick] = useState(0);

  // Init dark mode on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const setLang = (l: string) => { setLangState(l); localStorage.setItem('kozy_lang', l); };

  const toggleDark = () => setDark(d => {
    const next = !d;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('kozy_dark', String(next));
    return next;
  });

  const fetchCached = useCallback(async (url: string, force = false) => {
    const entry = cacheRef.current[url];
    if (!force && entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    const res = await fetch(url);
    const data = await res.json();
    cacheRef.current[url] = { data, ts: Date.now() };
    return data;
  }, []);

  const invalidateCache = useCallback((url: string) => {
    delete cacheRef.current[url];
  }, []);

  return (
    <AppContext.Provider value={{ lang, setLang, dark, toggleDark, cache: cacheRef.current, fetchCached, invalidateCache }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
