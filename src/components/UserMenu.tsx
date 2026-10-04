import { useEffect, useRef } from 'react';
import {
  ChevronDown,
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { AuthSession } from '../types/auth';

interface UserMenuProps {
  session: AuthSession;
  onLogin: () => void;
  onLogout: () => void;
  onPassword: () => void;
  onTrash: () => void;
  onUsers: () => void;
}

export function UserMenu({
  session,
  onLogin,
  onLogout,
  onPassword,
  onTrash,
  onUsers,
}: UserMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelScheduledClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const closeMenu = () => {
    cancelScheduledClose();

    if (menuRef.current) {
      menuRef.current.open = false;
    }
  };

  const scheduleClose = () => {
    cancelScheduledClose();

    closeTimer.current = window.setTimeout(() => {
      closeMenu();
    }, 220);
  };

  useEffect(() => {
    return () => cancelScheduledClose();
  }, []);

  const runAndClose = (action: () => void) => {
    closeMenu();
    action();
  };

  if (!session.authenticated || !session.user) {
    return (
      <button
        type="button"
        onClick={onLogin}
        className="chartlink-login-button"
        title="Entrar para editar e excluir"
      >
        <LogIn size={16} />
        <span className="hidden md:inline">Entrar</span>
      </button>
    );
  }

  return (
    <details
      ref={menuRef}
      className="chartlink-user-menu"
      onPointerEnter={cancelScheduledClose}
      onPointerLeave={scheduleClose}
    >
      <summary title={`Conectado como ${session.user.username}`}>
        {session.user.role === 'admin'
          ? <ShieldCheck size={17} />
          : <UserRound size={17} />}

        <span className="hidden lg:inline">
          {session.user.displayName}
        </span>

        <ChevronDown size={14} />
      </summary>

      <div
        className="chartlink-user-popover"
        onPointerEnter={cancelScheduledClose}
        onPointerLeave={closeMenu}
      >
        <header>
          <strong>{session.user.displayName}</strong>
          <span>
            @{session.user.username} ·{' '}
            {session.user.role === 'admin'
              ? 'Administrador'
              : 'Usuário'}
          </span>
        </header>

        <button
          type="button"
          onClick={() => runAndClose(onTrash)}
        >
          <Trash2 size={16} />
          Lixeira
        </button>

        <button
          type="button"
          onClick={() => runAndClose(onPassword)}
        >
          <KeyRound size={16} />
          Trocar senha
        </button>

        {session.permissions.manageUsers && (
          <button
            type="button"
            onClick={() => runAndClose(onUsers)}
          >
            <ShieldCheck size={16} />
            Usuários / logs
          </button>
        )}

        <button
          type="button"
          onClick={() => runAndClose(onLogout)}
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </details>
  );
}
