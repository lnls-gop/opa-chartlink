import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, KeyRound, LogIn } from 'lucide-react';
import { apiRequest, readApiError, updateAuthSession } from '../api/client';
import type { AuthSession } from '../types/auth';
import { AppDialog } from './AppDialog';

interface AuthDialogProps {
  mode: 'login' | 'change-password';
  mandatory?: boolean;
  onClose: () => void;
  onSession: (session: AuthSession) => void;
}

export function AuthDialog({ mode, mandatory = false, onClose, onSession }: AuthDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(''), [mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'change-password' && newPassword !== confirmation) {
      setError('As senhas não correspondem.');
      return;
    }
    setBusy(true);
    const response = await apiRequest(
      mode === 'login' ? '/api/auth/login' : '/api/auth/change-password',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login'
          ? { username, password }
          : { currentPassword, newPassword }),
      },
    );
    if (!response.ok) {
      setError(await readApiError(response, 'Não foi possível autenticar.'));
      setBusy(false);
      return;
    }
    const next = updateAuthSession(await response.json() as AuthSession);
    onSession(next);
    setPassword(''); setCurrentPassword(''); setNewPassword(''); setConfirmation('');
    setBusy(false);
    if (!(mode === 'login' && next.user?.mustChangePassword)) onClose();
  };

  const changing = mode === 'change-password';
  return (
    <AppDialog title={changing ? 'Trocar senha' : 'Entrar no ChartLink'} onClose={mandatory ? () => undefined : onClose} busy={busy}>
      <form onSubmit={submit} className="chartlink-auth-form space-y-4">
        <div className="chartlink-auth-intro">
          {changing ? <KeyRound aria-hidden="true" /> : <LogIn aria-hidden="true" />}
          <div>
            <strong>{changing ? 'Proteja sua conta' : 'Operações restritas'}</strong>
            <p>{changing
              ? 'A senha temporária deve ser substituída antes de editar ou excluir.'
              : 'Consultar, abrir e incluir links permanece disponível sem login.'}</p>
          </div>
        </div>
        {error && <div role="alert" className="chartlink-auth-error"><AlertCircle size={17} />{error}</div>}
        {!changing && <label className="chartlink-field-label">Usuário
          <input autoFocus autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required />
        </label>}
        {!changing && <label className="chartlink-field-label">Senha
          <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
        </label>}
        {changing && <label className="chartlink-field-label">Senha atual
          <input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
        </label>}
        {changing && <label className="chartlink-field-label">Nova senha
          <input type="password" minLength={6} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
	  <span>Use ao menos 6 caracteres, com letra maiúscula, minúscula e caracter especial. Não use a senha corporativa.</span>
        </label>}
        {changing && <label className="chartlink-field-label">Confirmar nova senha
          <input type="password" minLength={6} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
        </label>}
        <div className="flex gap-3 pt-2">
          {!mandatory && <button type="button" onClick={onClose} disabled={busy} className="chartlink-button-secondary flex-1">Cancelar</button>}
          <button type="submit" disabled={busy} className="chartlink-button-primary flex-1">
            {busy ? 'Aguarde…' : changing ? 'Salvar nova senha' : 'Entrar'}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}
