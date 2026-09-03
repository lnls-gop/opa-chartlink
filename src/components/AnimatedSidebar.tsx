import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const SIDEBAR_MIN_WIDTH = 260;
export const SIDEBAR_MAX_WIDTH = 720;
export const SIDEBAR_DEFAULT_WIDTH = 360;

export function clampSidebarWidth(width: number): number {
  return Number.isFinite(width)
    ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width))
    : SIDEBAR_DEFAULT_WIDTH;
}

interface AnimatedSidebarProps {
  id: string;
  open: boolean;
  width: number;
  resizing: boolean;
  onResizeStart: () => void;
  onWidthChange: (width: number) => void;
  children: ReactNode;
}

export function AnimatedSidebar({
  id, open, width, resizing, onResizeStart, onWidthChange, children,
}: AnimatedSidebarProps) {
  const reduceMotion = useReducedMotion();
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // React 18 não declara inert nos atributos JSX. O DOM mantém os controles
    // recolhidos fora da navegação por teclado, preservando a árvore e a rolagem.
    sidebarRef.current?.toggleAttribute('inert', !open);
  }, [open]);

  return (
    <motion.aside
      ref={sidebarRef}
      id={id}
      aria-label="Categorias"
      aria-hidden={!open}
      initial={false}
      animate={{ width: open ? width : 0 }}
      transition={{ duration: reduceMotion || resizing ? 0 : 0.24, ease: 'easeInOut' }}
      className="relative overflow-hidden shrink-0 min-h-0 bg-white flex flex-col"
      style={{ pointerEvents: open ? 'auto' : 'none' }}
    >
      <motion.div
        initial={false}
        animate={open
          ? { opacity: 1, visibility: 'visible' }
          : { opacity: 0, transitionEnd: { visibility: 'hidden' } }}
        transition={{ duration: reduceMotion ? 0 : 0.08, delay: open && !reduceMotion ? 0.16 : 0 }}
        className="relative flex flex-1 min-h-0 flex-col border-r border-zinc-200"
        style={{ width }}
      >
        <div
          role="separator"
          aria-label="Largura da barra de categorias"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={width}
          tabIndex={open ? 0 : -1}
          onMouseDown={event => {
            event.preventDefault();
            onResizeStart();
          }}
          onKeyDown={event => {
            let nextWidth: number;
            switch (event.key) {
              case 'ArrowLeft': nextWidth = width - 20; break;
              case 'ArrowRight': nextWidth = width + 20; break;
              case 'Home': nextWidth = SIDEBAR_MIN_WIDTH; break;
              case 'End': nextWidth = SIDEBAR_MAX_WIDTH; break;
              default: return;
            }
            event.preventDefault();
            onWidthChange(clampSidebarWidth(nextWidth));
          }}
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-300 active:bg-emerald-500 focus-visible:bg-emerald-300 z-30"
          title="Arraste ou use as setas para redimensionar a largura"
        />
        {children}
      </motion.div>
    </motion.aside>
  );
}
