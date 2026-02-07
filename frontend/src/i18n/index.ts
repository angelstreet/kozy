import en from './en.json';
import fr from './fr.json';
const langs: Record<string, Record<string, string>> = { en, fr };
export function t(key: string, lang: string): string {
  return langs[lang]?.[key] ?? key;
}
export default langs;
