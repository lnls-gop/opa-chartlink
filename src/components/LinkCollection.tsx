import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Tag } from 'lucide-react';
import type { ChartLink, FolderNode, SortOrder, ViewMode } from '../types/chartlink';
import { getCategoryStyle, linkPresentation } from '../styles/categoryStyles';
import { LinkCard, type LinkCardActions } from './LinkCard';

interface LinkCollectionProps extends LinkCardActions {
  links: readonly ChartLink[];
  folders: ReadonlyMap<number, FolderNode>;
  selectedFolderId: number | null;
  viewMode: ViewMode;
  sortOrder: SortOrder;
  selectedLinkIds: ReadonlySet<string>;
  copiedId: string | null;
  draggingLinkId: string | null;
  canManage: boolean;
}

export function LinkCollection({
  links, folders, selectedFolderId, viewMode, sortOrder, selectedLinkIds, copiedId, draggingLinkId, canManage, ...actions
}: LinkCollectionProps) {
  const reduceMotion = useReducedMotion();
  const layoutClass = viewMode === 'grid'
    ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3'
    : 'grid-cols-1 gap-1.5';

  const renderCards = (rows: readonly ChartLink[]) => (
    <AnimatePresence mode="popLayout">
      {rows.map(link => {
        const presentation = linkPresentation(link, folders, selectedFolderId);
        return (
          <motion.div
            key={link.id}
            data-link-id={link.id}
            layout={reduceMotion ? false : 'position'}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="min-w-0"
            style={getCategoryStyle(presentation.category, presentation.color)}
          >
            <LinkCard
              {...actions}
              link={link}
              category={presentation.category}
              subcategory={presentation.subcategory}
              viewMode={viewMode}
              selected={selectedLinkIds.has(link.id)}
              copied={copiedId === link.id}
              dragging={draggingLinkId === link.id}
              canManage={canManage}
            />
          </motion.div>
        );
      })}
    </AnimatePresence>
  );

  if (sortOrder === 'primary-tag') {
    const groups = new Map<string, { category: string; tag: string; links: ChartLink[] }>();
    links.forEach(link => {
      const presentation = linkPresentation(link, folders, selectedFolderId);
      const item = link.folderTagItems.find(tag => tag.level === 1 && tag.path[0] === presentation.category);
      const tag = item?.name || presentation.subcategory.split('/')[0]?.trim() || 'Sem tag primária';
      const key = `${presentation.category}\u0000${tag}`;
      const group = groups.get(key) || { category: presentation.category, tag, links: [] };
      group.links.push(link);
      groups.set(key, group);
    });
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
    const orderedGroups = [...groups.values()].sort((a, b) =>
      collator.compare(a.tag, b.tag) || collator.compare(a.category, b.category));

    return (
      <div aria-label="Links agrupados por tags primárias" className="chartlink-collection space-y-5">
        <AnimatePresence mode="popLayout">
          {orderedGroups.map(group => (
            <motion.section key={`${group.category}:${group.tag}`} layout={reduceMotion ? false : 'position'}
              initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="chartlink-group-heading">
                <Tag size={15} aria-hidden="true" />
                <h2>{group.tag}</h2>
                <span>{group.category}</span>
                <strong>{group.links.length}</strong>
              </div>
              <div className={`relative grid ${layoutClass}`}>{renderCards(group.links)}</div>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      aria-label="Links"
      className={`chartlink-collection relative grid ${layoutClass}`}
    >
      {/* A coleção permanece montada quando o filtro fica vazio. Assim, o
          último card também conclui exit; a troca lista/grid preserva as keys. */}
      {renderCards(links)}
    </div>
  );
}
