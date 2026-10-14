import type { ComponentType } from 'react';
import { Monitor, Moon, Sun, type LucideProps } from 'lucide-react';
import type { ResolvedTheme, ThemePreference } from '../theme/theme';

interface ThemeSelectorProps {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  onChange: (preference: ThemePreference) => void;
}

interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
  icon: ComponentType<LucideProps>;
}

const OPTIONS: readonly ThemeOption[] = [
  { value: 'light', label: 'Claro', description: 'Usar o tema claro', icon: Sun },
  { value: 'system', label: 'Sistema', description: 'Seguir o tema do sistema operacional', icon: Monitor },
  { value: 'dark', label: 'Escuro', description: 'Usar o tema escuro', icon: Moon },
];

export function ThemeSelector({ preference, resolved, onChange }: ThemeSelectorProps) {
  return (
    <div className="chartlink-theme-selector" role="group" aria-label="Escolher aparência">
      {OPTIONS.map(option => {
        const Icon = option.icon;
        const active = option.value === preference;
        const resolution = option.value === 'system' ? ` (${resolved === 'dark' ? 'escuro' : 'claro'})` : '';
        return (
          <button
            key={option.value}
            type="button"
            className="chartlink-theme-state"
            data-active={active}
            aria-pressed={active}
            aria-label={`Tema: ${option.label}`}
            title={`${option.description}${resolution}`}
            onClick={() => onChange(option.value)}
          >
            <Icon size={17} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
