import { useEffect, useState } from 'react';
import { AlertCircle, RotateCcw, Trash2 } from 'lucide-react';
import { apiRequest, readApiError } from '../api/client';
import type { AuthSession, TrashedLink } from '../types/auth';
import { AppDialog } from './AppDialog';

interface TrashDialogProps {
  session: AuthSession;
  onClose: () => void;
  onChanged: () => void;
}

const formatDate = (value: number) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value));

export function TrashDialog({ session, onClose, onChanged }: TrashDialogProps) {
  const [items, setItems] = useState<TrashedLink[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    const response = await apiRequest('/api/trash/links');
    if (response.ok) setItems(await response.json() as TrashedLink[]);
    else setError(await readApiError(response, 'Não foi possível abrir a lixeira.'));
  };
  useEffect(() => { void load(); }, []);

  const restore = async (id: string) => {
    setBusyId(id); setError('');
    const response = await apiRequest(`/api/trash/links/${encodeURIComponent(id)}/restore`, { method: 'POST' });
    if (response.ok) { setItems(current => current.filter(item => item.id !== id)); onChanged(); }
    else setError(await readApiError(response, 'Não foi possível restaurar o link.'));
    setBusyId('');
  };

  const purge = async (item: TrashedLink) => {
    if (!window.confirm(`Excluir definitivamente “${item.title}”? Esta ação não poderá ser desfeita.`)) return;
    setBusyId(item.id); setError('');
    const response = await apiRequest(`/api/trash/links/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    if (response.ok) setItems(current => current.filter(row => row.id !== item.id));
    else setError(await readApiError(response, 'Não foi possível excluir definitivamente.'));
    setBusyId('');
  };

  return <AppDialog wide title={`Lixeira · ${items.length} link${items.length === 1 ? '' : 's'}`} onClose={onClose} busy={!!busyId}>
    <div className="chartlink-trash-list">
      {error && <div role="alert" className="chartlink-auth-error"><AlertCircle size={17} />{error}</div>}
      {!error && items.length === 0 && <p className="chartlink-empty-message">A lixeira está vazia.</p>}
      {items.map(item => <article key={item.id} className="chartlink-trash-item">
        <div><strong>{item.title}</strong><span>{item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}</span>
          <small>Excluído em {formatDate(item.deleted_at)}{item.deleted_by_name ? ` por ${item.deleted_by_name}` : ''}</small></div>
        <div>
          <button type="button" disabled={busyId === item.id} onClick={() => void restore(item.id)} title="Restaurar"><RotateCcw size={16} />Restaurar</button>
          {session.permissions.purgeLinks && <button type="button" disabled={busyId === item.id} onClick={() => void purge(item)} className="is-danger" title="Excluir definitivamente"><Trash2 size={16} />Excluir</button>}
        </div>
      </article>)}
    </div>
  </AppDialog>;
}
