export interface SearchRecord { id: string; fields: string[] }
export interface RegexRequest { query: string; records: SearchRecord[] }
export type RegexResponse = { ids: string[]; error: null } | { ids: []; error: string };

export function compileRegex(query: string): RegExp {
  if (query.length > 512) throw new Error('Use uma expressão de até 512 caracteres.');
  const lastSlash = query.lastIndexOf('/');
  if (query.startsWith('/') && lastSlash > 0) {
    return new RegExp(query.slice(1, lastSlash), query.slice(lastSlash + 1));
  }
  return new RegExp(query, 'i');
}

export function matchRegex({ query, records }: RegexRequest): RegexResponse {
  try {
    const pattern = compileRegex(query);
    return {
      ids: records.filter(record => record.fields.some(field => {
        // Flags g/y não podem deixar estado de um campo para o próximo.
        pattern.lastIndex = 0;
        return pattern.test(field);
      })).map(record => record.id),
      error: null,
    };
  } catch (reason) {
    return { ids: [], error: `Expressão inválida: ${reason instanceof Error ? reason.message : 'revise a sintaxe.'}` };
  }
}
