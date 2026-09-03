import { Folder, FolderOpen } from 'lucide-react';
import { getCategoryStyle } from '../styles/categoryStyles';

interface CategoryFolderIconProps {
  color: string;
  open?: boolean;
  className?: string;
}

/** Pastas de categoria compartilham o preenchimento na árvore e nos diálogos. */
export function CategoryFolderIcon({ color, open = false, className = 'w-4 h-4' }: CategoryFolderIconProps) {
  const Icon = open ? FolderOpen : Folder;
  return <Icon aria-hidden="true" className={`chartlink-folder-icon shrink-0 ${className}`}
    style={getCategoryStyle('', color)} />;
}
