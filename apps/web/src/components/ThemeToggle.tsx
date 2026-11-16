import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../lib/theme';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
}) => {
  const { theme, setTheme, toggleTheme } = useTheme();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-xs text-muted-foreground hidden sm:inline">Theme</span>
      )}
      <div className="flex rounded-xl border border-border bg-secondary/80 p-1">
        {(['light', 'dark'] as Theme[]).map((mode) => {
          const active = theme === mode;
          const Icon = mode === 'light' ? Sun : Moon;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-label={`${mode} mode`}
              aria-pressed={active}
            >
              <Icon className="h-3.5 w-3.5" />
              {showLabel && <span className="capitalize">{mode}</span>}
            </button>
          );
        })}
      </div>
      {!showLabel && (
        <button
          type="button"
          onClick={toggleTheme}
          className="sr-only"
          aria-hidden
        >
          Toggle theme
        </button>
      )}
    </div>
  );
};
