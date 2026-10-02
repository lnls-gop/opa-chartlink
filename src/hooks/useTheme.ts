import { useEffect, useState } from 'react';
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '../theme/theme';

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export function useTheme(): ThemeState {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(preference, systemPrefersDark()));

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const synchronize = () => {
      const next = resolveTheme(preference, media.matches);
      setResolved(next);
      applyTheme(preference, next);
    };

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // O tema ainda funciona na sessão quando o navegador bloqueia o armazenamento.
    }

    synchronize();
    if (preference === 'system') media.addEventListener('change', synchronize);
    return () => media.removeEventListener('change', synchronize);
  }, [preference]);

  return { preference, resolved, setPreference };
}
