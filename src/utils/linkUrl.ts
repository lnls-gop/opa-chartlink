/** Resolve endereços web legados sem transformar um hostname em rota do App. */
export function resolveLinkUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const candidate = /^(https?:)?\/\//i.test(raw)
      ? (raw.startsWith('//') ? `http:${raw}` : raw)
      : /^(?:[^\s/:]+\.[^\s/:]+|localhost)(?::\d+)?(?:[/?#]|$)/i.test(raw)
        ? `http://${raw}` : raw;
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function displayLinkHost(value: string): string {
  const resolved = resolveLinkUrl(value);
  return resolved ? new URL(resolved).host : 'Endereço a revisar';
}

export function formatLinkDate(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Não informada';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Não informada'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
