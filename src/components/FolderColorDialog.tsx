import { useState } from 'react';
import { Check } from 'lucide-react';
import type { FolderNode } from '../types/chartlink';
import { getCategoryStyle } from '../styles/categoryStyles';
import { AppDialog } from './AppDialog';
import { CategoryFolderIcon } from './CategoryFolderIcon';

const PALETTE = [
  ['Azul', '#56aeff'], ['Índigo', '#818cf8'], ['Violeta', '#c084fc'], ['Rosa', '#fcaac7'],
  ['Coral', '#fb923c'], ['Amarelo', '#facc15'], ['Verde', '#86efac'], ['Turquesa', '#5eead4'],
  ['Ciano', '#b2ebf2'], ['Rosa pastel', '#f3d2d5'], ['Verde pastel', '#c8e6c9'], ['Lavanda', '#bbbbdd'],
  ['Cinza', '#94a3b8'], ['Grafite', '#334155'], ['Preto', '#000000'], ['Branco', '#ffffff'],
] as const;

interface FolderColorDialogProps {
  folder: FolderNode;
  inheritedColor: string;
  onSave: (color: string | null) => Promise<void>;
  onClose: () => void;
}

export function FolderColorDialog({ folder, inheritedColor, onSave, onClose }: FolderColorDialogProps) {
  const [color, setColor] = useState(folder.color || inheritedColor);
  const [inherit, setInherit] = useState(!folder.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^#[\da-f]{6}$/i.test(color);
  const preview = inherit ? inheritedColor : valid ? color : inheritedColor;
  const pick = (value: string) => { setColor(value); setInherit(false); };

  async function save() {
    setBusy(true); setError(null);
    try { await onSave(inherit ? null : color); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a cor.'); }
    finally { setBusy(false); }
  }

  return (
    <AppDialog title="Cor da pasta" onClose={onClose} busy={busy}>
      <div className="chartlink-color-preview flex items-center gap-3 rounded-xl p-4 mb-5" style={getCategoryStyle(folder.path[0] || folder.name, preview)}>
        <CategoryFolderIcon open color={preview} className="h-7 w-7" />
        <div className="min-w-0"><p className="font-semibold text-black break-words">{folder.name}</p>
          <p className="text-xs text-zinc-600 break-words">{folder.path.join(' / ')}</p></div>
      </div>
      <fieldset disabled={busy}>
        <legend className="text-sm font-medium mb-3">Escolha uma cor</legend>
        <div className="grid grid-cols-8 gap-2">
          {PALETTE.map(([name, hex]) => (
            <button type="button" key={hex} aria-label={`${name}: ${hex}`} aria-pressed={!inherit && color.toLowerCase() === hex}
              title={name} onClick={() => pick(hex)} style={{ backgroundColor: hex }} className="chartlink-color-swatch">
              {!inherit && color.toLowerCase() === hex && <Check className="w-4 h-4 rounded bg-white text-black" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-5">
          <input type="color" value={valid ? color : inheritedColor} onChange={event => pick(event.target.value)}
            aria-label="Selecionar cor personalizada" className="h-10 w-12 cursor-pointer rounded border border-zinc-200" />
          <label className="flex-1 text-xs text-zinc-600">Cor hexadecimal
            <input value={color} maxLength={7} onChange={event => pick(event.target.value)} spellCheck={false}
              aria-invalid={!inherit && !valid} className="block w-full rounded-lg border border-zinc-200 px-3 py-2 mt-1 font-mono text-sm text-black" />
          </label>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-zinc-700">
          <input type="checkbox" checked={inherit} onChange={event => setInherit(event.target.checked)} />
          {folder.parent_id === null ? 'Usar a cor padrão da categoria' : 'Herdar a cor da pasta superior'}
        </label>
      </fieldset>
      <p className="text-xs text-zinc-500 mt-3">Subpastas sem cor própria acompanham esta escolha. As letras permanecem pretas.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm">Cancelar</button>
        <button type="button" disabled={busy || (!inherit && !valid)} onClick={() => void save()}
          className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm disabled:opacity-40">{busy ? 'Salvando…' : 'Salvar cor'}</button>
      </div>
    </AppDialog>
  );
}
