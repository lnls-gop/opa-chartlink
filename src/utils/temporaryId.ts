let sequence = 0;

/**
 * Identifica itens apenas enquanto eles estão na memória do navegador.
 * Não é um UUID persistente: o Flask gera o ID definitivo ao salvar.
 */
export function createTemporaryId(prefix = 'temporary'): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}
