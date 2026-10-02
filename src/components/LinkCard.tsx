import type { DragEvent } from 'react';
import { Check, CheckSquare, Copy, CopyPlus, Edit2, Info, Square, Trash2 } from 'lucide-react';
import type { ChartLink, ViewMode } from '../types/chartlink';
import { CategoryArtDecoration, CategoryArtwork, CategoryIdentity, CategoryListEmblem } from './CategoryArtwork';
import { resolveLinkUrl } from '../utils/linkUrl';

export interface LinkCardActions {
  onToggleSelection: (id: string) => void;
  onShare: (link: ChartLink) => void;
  onCopy: (id: string) => void;
  onEdit: (link: ChartLink) => void;
  onDelete: (id: string) => void;
  onInfo: (link: ChartLink) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, link: ChartLink) => void;
  onDragEnd: () => void;
}

interface LinkCardProps extends LinkCardActions {
  link: ChartLink;
  category: string;
  subcategory: string;
  viewMode: ViewMode;
  selected: boolean;
  copied: boolean;
  dragging: boolean;
  canManage: boolean;
}

export function LinkCard({
  link, category, subcategory, viewMode, selected, copied, dragging, canManage,
  onToggleSelection, onShare, onCopy, onEdit, onDelete, onInfo, onDragStart, onDragEnd,
}: LinkCardProps) {
  const grid = viewMode === 'grid';
  const href = resolveLinkUrl(link.url);
  const selection = canManage ? (
    <button type="button" onClick={() => onToggleSelection(link.id)}
      aria-label={`Selecionar ${link.title}`} aria-pressed={selected} title="Selecionar link"
      className={'chartlink-selection-button ' + (selected ? 'is-selected' : '')}>
      {selected ? <CheckSquare size={17} /> : <Square size={17} />}
    </button>
  ) : null;
  const actions = (
    <div className="chartlink-card-actions" aria-label={`Ações de ${link.title}`}>
      <button type="button" onClick={() => onInfo(link)} className="chartlink-action-button"
        aria-label={`Informações de ${link.title}`} title="Informações, criação e edição"><Info size={16} /></button>
      <button type="button" onClick={() => onShare(link)} className="chartlink-action-button"
        aria-label={`Copiar URL de ${link.title}`} title="Copiar URL">
        {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
      </button>
      {canManage && <button type="button" onClick={() => onCopy(link.id)} className="chartlink-action-button"
        aria-label={`Copiar ${link.title} para outra categoria`} title="Copiar para outra pasta"><CopyPlus size={16} /></button>
      }{canManage && <button type="button" onClick={() => onEdit(link)} className="chartlink-action-button"
        aria-label={`Editar ${link.title}`} title="Editar link"><Edit2 size={16} /></button>
      }{canManage && <button type="button" onClick={() => onDelete(link.id)} className="chartlink-action-button chartlink-action-danger"
        aria-label={`Excluir ${link.title}`} title="Excluir link"><Trash2 size={16} /></button>
      }
    </div>
  );

  return (
    <div draggable={canManage} onDragStart={event => { if (canManage) onDragStart(event, link); }} onDragEnd={onDragEnd}
      className={'chartlink-link-card group h-full min-w-0 ' +
        (grid ? 'chartlink-card-grid' : 'chartlink-card-list') + (dragging ? ' opacity-50' : '')}>
      {/* Uma âncora nativa cobre todo o card/linha. Os botões são irmãos com
          z-index superior: selecionar, editar ou ver infos nunca abre a URL. */}
      <a href={href || undefined} target="_blank" rel="noopener noreferrer" draggable={false}
        aria-label={href ? `Abrir ${link.title} em nova aba` : `Endereço inválido: ${link.title}`}
        aria-disabled={!href} title={href ? `Abrir ${link.title} em nova aba` : 'Edite o endereço deste link'}
        className="chartlink-card-open" onClick={event => { event.stopPropagation(); if (!href) event.preventDefault(); }} />
      {grid ? (
        <>
          <div className="chartlink-card-toolbar">{selection}{actions}</div>
          <CategoryArtwork category={category} subcategory={subcategory} />
          <div className="chartlink-grid-body">
            <h3 className="chartlink-link-title line-clamp-2">{link.title}</h3>
            {link.description?.trim() && <p className="chartlink-card-description line-clamp-2">{link.description}</p>}
            {!href && <p className="chartlink-card-description">Endereço a revisar</p>}
          </div>
        </>
      ) : (
        <>
          <CategoryArtDecoration category={category} />
          <div className="chartlink-list-selection">{selection}</div>
          <div className="chartlink-list-main">
            <h3 className="chartlink-link-title line-clamp-2">{link.title}</h3>
            {link.description?.trim() && <p className="chartlink-card-description line-clamp-1">{link.description}</p>}
            {!href && <p className="chartlink-card-description">Endereço a revisar</p>}
          </div>
          <div className="chartlink-list-context">
            <CategoryIdentity category={category} subcategory={subcategory} variant="list" />
          </div>
          <CategoryListEmblem category={category} />
          <div className="chartlink-list-actions">{actions}</div>
        </>
      )}
    </div>
  );
}
