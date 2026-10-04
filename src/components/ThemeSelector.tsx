import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Check, ChevronDown, Monitor, Moon, Sun, type LucideProps } from 'lucide-react';
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
  { value: 'dark', label: 'Escuro', description: 'Usar o tema escuro', icon: Moon },
  { value: 'system', label: 'Sistema', description: 'Seguir o tema do sistema operacional', icon: Monitor },
];

export function ThemeSelector({ preference, resolved, onChange }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = OPTIONS.find(option => option.value === preference) ?? OPTIONS[2];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={root} className="chartlink-theme-selector">
      <button
        type="button"
        className="chartlink-theme-trigger"
        aria-label={`Tema: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Tema: ${selected.label}${preference === 'system' ? ` (${resolved === 'dark' ? 'escuro' : 'claro'})` : ''}`}
        onClick={() => setOpen(current => !current)}
      >
        <SelectedIcon size={18} aria-hidden="true" />
        <span className="chartlink-theme-trigger-label">{selected.label}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {open && (
        <div className="chartlink-theme-menu" role="menu" aria-label="Escolher aparência">
          {OPTIONS.map(option => {
            const Icon = option.icon;
            const active = option.value === preference;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className="chartlink-theme-option"
                data-active={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
                {active && <Check size={16} className="chartlink-theme-check" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
