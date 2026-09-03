export interface FolderNode {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  path: string[];
  link_count?: number;
  color?: string | null;
}

export interface ChartLink {
  id: string;
  title: string;
  url: string;
  category: string;
  subcategory: string;
  description?: string;
  createdAt: number;
  updatedAt?: number | null;
  folderId: number | null;
  folderPath: string[];
  folderIds: number[];
  folderPaths: string[][];
  folderTags: string[];
  folderTagItems: { id: number | null; name: string; level: number; path: string[] }[];
}

export interface Subcategory {
  id: number;
  name: string;
  category: string;
}

export type ViewMode = 'grid' | 'list';
export type SortOrder = 'recent' | 'az' | 'za';
