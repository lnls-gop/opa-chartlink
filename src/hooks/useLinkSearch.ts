import { useEffect, useMemo, useState } from 'react';
import type { ChartLink, FolderNode } from '../types/chartlink';
import type { RegexResponse, SearchRecord } from '../search/matcher';

interface RegexState {
  query: string;
  records: SearchRecord[];
  response: RegexResponse;
}

export function useLinkSearch(links: readonly ChartLink[], folders: ReadonlyMap<number, FolderNode>, query: string, regex: boolean) {
  const records = useMemo<SearchRecord[]>(() => links.map(link => ({
    id: link.id,
    fields: [link.title, link.url, link.description || '', link.category, link.subcategory,
      ...link.folderTags, ...link.folderPaths.map(path => path.join(' / ')),
      ...link.folderIds.flatMap(id => folders.get(id)?.path || [])],
  })), [links, folders]);
  const [state, setState] = useState<RegexState | null>(null);
  const active = query.trim().length > 0;
  const literalIds = useMemo(() => !regex && active ? new Set(records
    .filter(record => record.fields.some(field => field.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))))
    .map(record => record.id)) : null, [records, regex, active, query]);

  useEffect(() => {
    if (!regex || !active) return;
    let worker: Worker | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const finish = (response: RegexResponse) => {
      if (cancelled) return;
      clearTimeout(deadline);
      worker?.terminate();
      setState({ query, records, response });
    };
    const debounce = setTimeout(() => {
      try {
        worker = new Worker(new URL('../search/regex.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<RegexResponse>) => finish(event.data);
        worker.onerror = event => {
          event.preventDefault();
          finish({ ids: [], error: 'Não foi possível executar a expressão. Tente novamente ou use a busca textual.' });
        };
        deadline = setTimeout(() => finish({ ids: [], error: 'A expressão excedeu 1 segundo de busca. Simplifique o padrão.' }), 1000);
        worker.postMessage({ query, records });
      } catch {
        finish({ ids: [], error: 'A busca regex não está disponível neste navegador. Use a busca textual.' });
      }
    }, 160);
    return () => { cancelled = true; clearTimeout(debounce); clearTimeout(deadline); worker?.terminate(); };
  }, [records, query, regex, active]);

  const current = state?.query === query && state.records === records ? state.response : null;
  const regexIds = useMemo(() => new Set(current?.ids || []), [current]);
  return {
    ids: !active ? null : regex ? regexIds : literalIds,
    pending: active && regex && !current,
    error: active && regex ? current?.error || null : null,
  };
}
