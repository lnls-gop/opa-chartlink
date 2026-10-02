import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderPlus,
  Globe2,
  MoreVertical,
  Palette,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';

interface FolderActionsMenuProps {
  folderName: string;
  onColor?: () => void;
  onDelete?: () => void;
  onAddLink?: () => void;
  onAddSubcategory?: () => void;
  onSelectDestination?: () => void;
  onRename?: () => void;
}

interface PopoverPosition {
  left: number;
  top: number;
}

export function FolderActionsMenu({
  folderName,
  onColor,
  onDelete,
  onAddLink,
  onAddSubcategory,
  onSelectDestination,
  onRename,
}: FolderActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelScheduledClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelScheduledClose();

    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      closeTimer.current = null;
    }, 220);
  };

  const closeMenu = () => {
    cancelScheduledClose();
    setOpen(false);
  };

  const updatePosition = () => {
    const triggerElement = trigger.current;
    if (!triggerElement) return;

    const rect = triggerElement.getBoundingClientRect();
    setPosition({
      left: rect.right + 8,
      top: Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2)),
    });
  };

  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !popover.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const reposition = () => updatePosition();
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => () => cancelScheduledClose(), []);

  const run = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    setOpen(false);
    action();
  };

  const actions = open && position && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={popover}
        className="chartlink-folder-action-popover"
        role="menu"
        aria-label={`Ações de ${folderName}`}
        style={position}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
	onPointerEnter={cancelScheduledClose}
	onPointerLeave={closeMenu}        
      >
        {onColor && <button type="button" role="menuitem" onClick={event => run(event, onColor)}
          title="Alterar cor da pasta" aria-label={`Alterar cor de ${folderName}`}><Palette size={16} /></button>}
        {onAddLink && <button type="button" role="menuitem" onClick={event => run(event, onAddLink)}
          title="Adicionar URL" aria-label={`Adicionar URL em ${folderName}`}><Globe2 size={16} /></button>}
        {onAddSubcategory && <button type="button" role="menuitem" onClick={event => run(event, onAddSubcategory)}
          title="Adicionar subcategoria" aria-label={`Adicionar subcategoria em ${folderName}`}><FolderPlus size={16} /></button>}
        {onSelectDestination && <button type="button" role="menuitem" onClick={event => run(event, onSelectDestination)}
          title="Selecionar como destino" aria-label={`Selecionar ${folderName} como destino`}><Send size={16} /></button>}
        {onRename && <button type="button" role="menuitem" onClick={event => run(event, onRename)}
          title="Renomear" aria-label={`Renomear ${folderName}`}><Pencil size={16} /></button>}
        {onDelete && <button type="button" role="menuitem" className="chartlink-folder-action-danger"
          onClick={event => run(event, onDelete)} title="Excluir" aria-label={`Excluir ${folderName}`}><Trash2 size={16} /></button>}
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div
        ref={root}
        className="chartlink-folder-menu"
        data-open={open}
        draggable={false}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
    	onPointerEnter={cancelScheduledClose}
	onPointerLeave={scheduleClose}
      >
        <button
          ref={trigger}
          type="button"
          className="chartlink-folder-menu-trigger"
          aria-label={`Opções de ${folderName}`}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Opções da pasta"
          onClick={event => {
            event.stopPropagation();
            if (open) {
              setOpen(false);
              return;
            }
            updatePosition();
            setOpen(true);
          }}
        >
          <MoreVertical size={17} aria-hidden="true" />
        </button>
      </div>
      {actions}
    </>
  );
}
