import type { ChartLink, FolderNode, SortOrder } from '../types/chartlink';

const titleCollator = new Intl.Collator('pt-BR', {
  sensitivity: 'base', numeric: true, ignorePunctuation: true,
});

function compareTitles(a: ChartLink, b: ChartLink): number {
  return titleCollator.compare(a.title.trim().normalize('NFC'), b.title.trim().normalize('NFC'))
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function rootCategory(link: ChartLink): string {
  return link.folderPaths[0]?.[0] || link.folderPath[0] || link.category || '';
}

function primaryTag(link: ChartLink): string {
  return link.folderTagItems.find(item => item.level === 1)?.name
    || link.folderPaths[0]?.[1]
    || link.folderPath[1]
    || link.subcategory.split('/')[0]?.trim()
    || 'Sem tag primária';
}

/** Ordenação natural por título, sem alterar a coleção recebida. */
export function sortLinks(links: readonly ChartLink[], order: SortOrder): ChartLink[] {
  return [...links].sort((a, b) => {
    if (order === 'az') return compareTitles(a, b);
   
    if (order === 'za') return -compareTitles(a, b);

    if (order === 'category-az') {
      return titleCollator.compare(rootCategory(a), rootCategory(b)) || compareTitles(a, b);
    }
    
    if (order === 'category-za') {
      return (
        titleCollator.compare(rootCategory(b), rootCategory(a))
        || compareTitles(a, b)
      );
    }

    if (order === 'primary-tag') {
      return titleCollator.compare(primaryTag(a), primaryTag(b)) || compareTitles(a, b);
    }

    if (order === 'recent-edited') {
      const aDate =
        typeof a.updatedAt === 'number' && Number.isFinite(a.updatedAt)
          ? a.updatedAt
          : Number.isFinite(a.createdAt)
            ? a.createdAt
            : -Infinity;

      const bDate =
        typeof b.updatedAt === 'number' && Number.isFinite(b.updatedAt)
          ? b.updatedAt
          : Number.isFinite(b.createdAt)
            ? b.createdAt
            : -Infinity;

      return (
        (aDate === bDate ? 0 : aDate > bDate ? -1 : 1)
        || compareTitles(a, b)
      );
    }

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
