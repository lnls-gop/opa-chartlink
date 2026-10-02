import { useEffect, useState, type FormEvent } from 'react';
import { Activity, AlertCircle, Plus, RefreshCw, Users } from 'lucide-react';
import { apiRequest, readApiError } from '../api/client';
import type { AuditEntry, ManagedUser, UserRole } from '../types/auth';
import { AppDialog } from './AppDialog';

interface AdminUsersDialogProps { currentUserId: number; onClose: () => void; }

const AUDIT_LABELS: Record<string, string> = {
  login_succeeded: 'Login realizado', login_failed: 'Tentativa de login recusada', logout: 'Sessão encerrada',
  password_changed: 'Senha alterada', user_created: 'Usuário criado', user_updated: 'Usuário atualizado',
  link_created: 'Link incluído', link_updated: 'Link editado', link_trashed: 'Link enviado à lixeira',
  links_trashed: 'Links enviados à lixeira', link_restored: 'Link restaurado', link_purged: 'Link excluído definitivamente',
  links_imported: 'Links importados', links_moved: 'Links movidos', links_copied: 'Links copiados',
  folder_created: 'Pasta criada', folder_updated: 'Pasta alterada', folder_moved: 'Pasta movida',
  folder_deleted: 'Pasta excluída', folder_color_updated: 'Cor da pasta alterada',
  category_created: 'Categoria criada', category_updated: 'Categoria alterada', category_deleted: 'Categoria excluída',
  subcategory_created: 'Subcategoria criada', subcategory_updated: 'Subcategoria alterada', subcategory_deleted: 'Subcategoria excluída',
};

const formatDate = (value?: number | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Nunca';

export function AdminUsersDialog({ currentUserId, onClose }: AdminUsersDialogProps) {
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'user' as UserRole });
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const loadUsers = async () => {
    const response = await apiRequest('/api/admin/users');
    if (response.ok) setUsers(await response.json() as ManagedUser[]);
    else setError(await readApiError(response, 'Não foi possível carregar os usuários.'));
  };
  const loadAudit = async () => {
    const response = await apiRequest('/api/admin/audit?limit=150');
    if (response.ok) setAudit(await response.json() as AuditEntry[]);
    else setError(await readApiError(response, 'Não foi possível carregar o log de monitoramento.'));
  };
  useEffect(() => { void loadUsers(); }, []);
  useEffect(() => { if (tab === 'audit') void loadAudit(); }, [tab]);

  const createUser = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const response = await apiRequest('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (response.ok) { setForm({ username: '', displayName: '', password: '', role: 'user' }); await loadUsers(); }
    else setError(await readApiError(response, 'Não foi possível criar o usuário.'));
    setBusy(false);
  };

  const updateUser = async (user: ManagedUser, changes: Partial<{ displayName: string; role: UserRole; active: boolean; newPassword: string }>) => {
    setBusy(true); setError('');
    const response = await apiRequest(`/api/admin/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: user.display_name, role: user.role, active: !!user.active, ...changes }),
    });
    if (response.ok) await loadUsers();
    else setError(await readApiError(response, 'Não foi possível atualizar o usuário.'));
    setBusy(false);
    return response.ok;
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetTarget) return;
    if (await updateUser(resetTarget, { newPassword: temporaryPassword })) {
      setResetTarget(null);
      setTemporaryPassword('');
    }
  };

  return <AppDialog wide title="Usuários/ Logs" onClose={onClose} busy={busy}>
    <div className="chartlink-admin-panel">
      <nav><button type="button" className={tab === 'users' ? 'is-active' : ''} onClick={() => setTab('users')}><Users size={16} />Usuários</button>
        <button type="button" className={tab === 'audit' ? 'is-active' : ''} onClick={() => setTab('audit')}><Activity size={16} />Log</button></nav>
      {error && <div role="alert" className="chartlink-auth-error"><AlertCircle size={17} />{error}</div>}
      {tab === 'users' && <>
        <form onSubmit={createUser} className="chartlink-user-create-form">
          <h3><Plus size={16} />Novo usuário</h3>
          <input required minLength={3} placeholder="Login" autoComplete="off" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          <input required placeholder="Nome de exibição" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
          <input required minLength={6} type="password" placeholder="Senha temporária (6+ caracteres)" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}><option value="user">Usuário</option><option value="admin">Administrador</option></select>
          <button type="submit" disabled={busy} className="chartlink-button-primary"><Plus size={16} />Criar</button>
        </form>
        {resetTarget && <form onSubmit={resetPassword} className="chartlink-password-reset-form">
          <div><strong>Redefinir senha de {resetTarget.display_name}</strong><span>A senha será ocultada e deverá ser trocada no próximo acesso.</span></div>
          <input autoFocus required minLength={6} type="password" autoComplete="new-password" placeholder="Senha temporária (6+ caracteres)" value={temporaryPassword} onChange={event => setTemporaryPassword(event.target.value)} />
          <button type="button" disabled={busy} className="chartlink-button-secondary" onClick={() => { setResetTarget(null); setTemporaryPassword(''); }}>Cancelar</button>
          <button type="submit" disabled={busy} className="chartlink-button-primary">Salvar senha</button>
        </form>}
        <div className="chartlink-users-list">{users.map(user => <article key={user.id}>
          <div><strong>{user.display_name}</strong><span>@{user.username} · Último acesso: {formatDate(user.last_login_at)}</span>{user.must_change_password ? <small>Troca de senha pendente</small> : null}</div>
          <select aria-label={`Perfil de ${user.username}`} value={user.role} disabled={busy || user.id === currentUserId} title={user.id === currentUserId ? 'Outro administrador deve alterar seu perfil.' : undefined} onChange={event => void updateUser(user, { role: event.target.value as UserRole })}><option value="user">Usuário</option><option value="admin">Administrador</option></select>
          <label className="chartlink-active-toggle" title={user.id === currentUserId ? 'Você não pode desativar a própria conta.' : undefined}><input type="checkbox" checked={!!user.active} disabled={busy || user.id === currentUserId} onChange={event => void updateUser(user, { active: event.target.checked })} />Ativo</label>
          <button type="button" disabled={busy} onClick={() => { setResetTarget(user); setTemporaryPassword(''); }}><RefreshCw size={15} />Redefinir senha</button>
        </article>)}</div>
      </>}
      {tab === 'audit' && <div className="chartlink-audit-list">
        <button type="button" onClick={() => void loadAudit()} className="chartlink-refresh-button"><RefreshCw size={15} />Atualizar</button>
        {audit.map(entry => <article key={entry.id}><div><strong>{AUDIT_LABELS[entry.action] || entry.action}</strong><span>{entry.actor_username || 'Visitante'} · {entry.ip_address}</span></div><small>{entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ''}<br />{formatDate(entry.created_at)}</small></article>)}
      </div>}
    </div>
  </AppDialog>;
}
