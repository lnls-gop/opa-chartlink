import { useRef } from 'react';
import { Regex, Search, X } from 'lucide-react';

interface LinkSearchInputProps {
  query: string;
  regex: boolean;
  invalid: boolean;
  scopeLabel: string;
  onQueryChange: (query: string) => void;
  onRegexChange: (enabled: boolean) => void;
}

export function LinkSearchInput({ query, regex, invalid, scopeLabel, onQueryChange, onRegexChange }: LinkSearchInputProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="relative flex-1 min-w-0 max-w-md">
      <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
      <input ref={input} type="search" aria-label="Buscar links" title={`Buscar em: ${scopeLabel}`}
        placeholder={regex ? 'Regex: ^LI_|Temperatura' : 'Buscar links...'}
        aria-invalid={invalid} aria-describedby={regex ? 'chartlink-search-scope chartlink-regex-help' : 'chartlink-search-scope'}
        className="chartlink-search-input w-full pl-9 pr-20 py-2 bg-zinc-100 rounded-xl text-sm border-none focus:ring-2 focus:ring-emerald-500"
        value={query} onChange={event => onQueryChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape' && query) { event.preventDefault(); onQueryChange(''); }
        }} />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {query.length > 0 && <button type="button" aria-label="Limpar busca" title="Limpar busca (Esc)"
          className="p-1.5 rounded-lg text-zinc-500 hover:bg-white focus-visible:outline-emerald-600"
          onClick={() => { onQueryChange(''); input.current?.focus(); }}>
          <X size={18} aria-hidden="true" />
        </button>}
        <button type="button" onClick={() => onRegexChange(!regex)} aria-pressed={regex}
          aria-label="Usar expressão regular" title="Ativar/desativar expressão regular"
          className={'p-1.5 rounded-lg ' + (regex ? 'bg-violet-100 text-violet-800' : 'text-zinc-500 hover:bg-white')}>
          <Regex size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
