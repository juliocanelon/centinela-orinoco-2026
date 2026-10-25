import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeAccent = 'caudal' | 'senal' | 'jade' | 'oro' | 'orquidea';

export const THEME_ACCENTS: { id: ThemeAccent; label: string; swatch: string }[] = [
  { id: 'caudal', label: 'Caudal', swatch: '#42baf0' },
  { id: 'senal', label: 'Señal', swatch: '#8189ff' },
  { id: 'jade', label: 'Jade', swatch: '#34d3a6' },
  { id: 'oro', label: 'Oro', swatch: '#fbbf24' },
  { id: 'orquidea', label: 'Orquídea', swatch: '#e879f9' },
];

const STORAGE_KEY = 'centinela_theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

type ThemeSettings = { mode: ThemeMode; accent: ThemeAccent };

const readSettings = (): ThemeSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { mode: saved.mode ?? 'dark', accent: saved.accent ?? 'caudal' };
  } catch {
    return { mode: 'dark', accent: 'caudal' };
  }
};

const resolveMode = (mode: ThemeMode): 'light' | 'dark' =>
  mode === 'system' ? (window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark') : mode;

// Estado del tema: escribe data-mode y data-accent en <html>, que theme.css usa
// para cambiar las variables de color de toda la app.
export function useTheme() {
  const [settings, setSettings] = useState<ThemeSettings>(readSettings);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = resolveMode(settings.mode);
      root.dataset.mode = resolved;
      root.dataset.accent = settings.accent;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f2f5f8' : '#080d14');
    };
    apply();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Sin almacenamiento disponible el tema dura solo esta sesión.
    }
    if (settings.mode !== 'system') return;
    const media = window.matchMedia(LIGHT_QUERY);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings]);

  return {
    mode: settings.mode,
    accent: settings.accent,
    setMode: (mode: ThemeMode) => setSettings((s) => ({ ...s, mode })),
    setAccent: (accent: ThemeAccent) => setSettings((s) => ({ ...s, accent })),
  };
}
