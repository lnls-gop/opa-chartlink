import type { CSSProperties } from 'react';
import type { ChartLink, FolderNode } from '../types/chartlink';
import { UNCLASSIFIED_CATEGORY, UNCLASSIFIED_CATEGORY_COLOR } from '../constants/categories';

const CATEGORY_COLORS: Readonly<Record<string, string>> = {
  LINAC: '#f3d2d5',
  LTB: '#fcaac7',
  BOOSTER: '#c8e6c9',
  BTS: '#b2ebf2',
  'ANEL (SI)': '#56aeff',
  IDs: '#bbbbdd',
  [UNCLASSIFIED_CATEGORY]: UNCLASSIFIED_CATEGORY_COLOR,
};

export type CategoryStyle = CSSProperties & {
  '--chartlink-category-color': string;
  '--chartlink-category-rgb': string;
};

export function categoryColor(rootName: string | undefined): string {
  const key = Object.keys(CATEGORY_COLORS).find(
    name => name.toLowerCase() === rootName?.trim().toLowerCase(),
  );
  return key ? CATEGORY_COLORS[key] : '#000000';
}

function hexToRgb(hex: string): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgb(hex)}, ${alpha})`;
}

export function getCategoryStyle(rootName: string, customColor?: string): CategoryStyle {
  const color = customColor && /^#[\da-f]{6}$/i.test(customColor) ? customColor : categoryColor(rootName);
  return {
    '--chartlink-category-color': color,
    '--chartlink-category-rgb': hexToRgb(color),
  };
}

export function resolveFolderColor(id: number | null, folders: ReadonlyMap<number, FolderNode>): string {
  let folder = id === null ? undefined : folders.get(id);
  const rootName = folder?.path[0] || folder?.name;
  const visited = new Set<number>();
  while (folder && !visited.has(folder.id)) {
    visited.add(folder.id);
    if (folder.color && /^#[\da-f]{6}$/i.test(folder.color)) return folder.color;
    folder = folder.parent_id === null ? undefined : folders.get(folder.parent_id);
  }
  return categoryColor(rootName);
}

export function linkPresentation(link: ChartLink, folders: ReadonlyMap<number, FolderNode>, selectedFolderId: number | null) {
  // Uma classificação pode ser cópia em outra árvore: no filtro de pasta,
  // escolhemos a associação descendente desse filtro, sem alterar o link.
  const belongsToSelection = (id: number): boolean => {
    const visited = new Set<number>();
    let folder = folders.get(id);
    while (folder && !visited.has(folder.id)) {
      if (folder.id === selectedFolderId) return true;
      visited.add(folder.id);
      folder = folder.parent_id === null ? undefined : folders.get(folder.parent_id);
    }
    return false;
  };
  const id = (selectedFolderId === null ? undefined : link.folderIds.find(belongsToSelection))
    ?? link.folderId ?? link.folderIds[0];
  const folder = id === undefined ? undefined : folders.get(id);
  const category = folder?.path[0] || link.category;
  return {
    category,
    subcategory: folder ? folder.path.slice(1).join(' / ') : link.subcategory,
    color: folder ? resolveFolderColor(folder.id, folders) : categoryColor(category),
  };
}
