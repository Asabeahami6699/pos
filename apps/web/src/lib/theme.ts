export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pos-theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  if (theme === 'light') root.classList.add('light');
  root.style.colorScheme = theme;
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
