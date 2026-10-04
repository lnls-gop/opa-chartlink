import type { AuthSession } from '../types/auth';

let csrfToken = '';

function mergeHeaders(source?: HeadersInit): Headers {
  const headers = new Headers(source);
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  return headers;
}

export function updateAuthSession(session: AuthSession): AuthSession {
  csrfToken = session.csrfToken;
  return session;
}

export async function loadAuthSession(): Promise<AuthSession> {
  const response = await window.fetch('/api/auth/session', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Não foi possível iniciar a sessão de segurança.');
  return updateAuthSession(await response.json() as AuthSession);
}

export async function apiRequest(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const response = await window.fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers: mergeHeaders(init.headers),
  });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('chartlink:auth-required'));
  } else if (response.status === 403) {
    const payload = await response.clone().json().catch(() => ({})) as { code?: string; error?: string };
    if (payload.code === 'password_change_required') {
      window.dispatchEvent(new CustomEvent('chartlink:password-change-required'));
    }
  }
  return response;
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  return payload.error || fallback;
}
