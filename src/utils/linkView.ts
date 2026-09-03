import type { ChartLink, FolderNode, SortOrder } from '../types/chartlink';

const titleCollator = new Intl.Collator('pt-BR', {
  sensitivity: 'base', numeric: true, ignorePunctuation: true,
});

function compareTitles(a: ChartLink, b: ChartLink): number {
  return titleCollator.compare(a.title.trim().normalize('NFC'), b.title.trim().normalize('NFC'))
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Ordenação natural por título, sem alterar a coleção recebida. */
export function sortLinks(links: readonly ChartLink[], order: SortOrder): ChartLink[] {
  return [...links].sort((a, b) => {
    if (order === 'az') return compareTitles(a, b);
    if (order === 'za') return -compareTitles(a, b);
    const aDate = Number.isFinite(a.createdAt) ? a.createdAt : -Infinity;
    const bDate = Number.isFinite(b.createdAt) ? b.createdAt : -Infinity;
    return (aDate === bDate ? 0 : aDate > bDate ? -1 : 1) || compareTitles(a, b);
  });
}

export interface LinkScope {
  folderId: number | null;
  category: string;
  subcategory: string;
}

/** As associações da árvore prevalecem sobre a classificação principal legada. */
export function scopeLinks(
  links: readonly ChartLink[], folders: ReadonlyMap<number, FolderNode>, scope: LinkScope,
): ChartLink[] {
  const ids = new Set<number>();
  if (scope.folderId !== null) {
    ids.add(scope.folderId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders.values()) {
        if (folder.parent_id !== null && ids.has(folder.parent_id) && !ids.has(folder.id)) {
          ids.add(folder.id);
          changed = true;
        }
      }
    }
  }
  return links.filter(link => {
    const associations = link.folderIds.length ? link.folderIds : link.folderId === null ? [] : [link.folderId];
    const matchesPath = (path: readonly string[]) =>
      (scope.category === 'Todos' || path[0] === scope.category)
      && (scope.subcategory === 'Todas' || path[1] === scope.subcategory);
    if (scope.folderId !== null) {
      return associations.some(id => ids.has(id) && (scope.subcategory === 'Todas'
        || matchesPath(folders.get(id)?.path || link.folderPath)));
    }
    const paths = associations.flatMap(id => {
      const folder = folders.get(id);
      return folder ? [folder.path] : [];
    });
    return (paths.length ? paths : link.folderPaths.length ? link.folderPaths : [[link.category, link.subcategory]])
      .some(matchesPath);
  });
}
