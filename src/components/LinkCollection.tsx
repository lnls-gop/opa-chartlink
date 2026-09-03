import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ChartLink, FolderNode, ViewMode } from '../types/chartlink';
import { getCategoryStyle, linkPresentation } from '../styles/categoryStyles';
import { LinkCard, type LinkCardActions } from './LinkCard';

interface LinkCollectionProps extends LinkCardActions {
  links: readonly ChartLink[];
  folders: ReadonlyMap<number, FolderNode>;
  selectedFolderId: number | null;
  viewMode: ViewMode;
  selectedLinkIds: ReadonlySet<string>;
  copiedId: string | null;
  draggingLinkId: string | null;
}

export function LinkCollection({
  links, folders, selectedFolderId, viewMode, selectedLinkIds, copiedId, draggingLinkId, ...actions
}: LinkCollectionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-label="Links"
      className={'chartlink-collection relative grid ' + (viewMode === 'grid'
        ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3'
        : 'grid-cols-1 gap-2')}
    >
      {/* A coleção permanece montada quando o filtro fica vazio. Assim, o
          último card também conclui exit; a troca lista/grid preserva as keys. */}
      <AnimatePresence mode="popLayout">
        {links.map(link => {
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
            />
          </motion.div>
        ); })}
      </AnimatePresence>
    </div>
  );
}
