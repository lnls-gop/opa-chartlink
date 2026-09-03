import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

interface AppDialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}

export function AppDialog({ title, children, onClose, busy = false }: AppDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} className="chartlink-dialog"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.16 }} className="chartlink-dialog-body">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-100 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} autoFocus
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40" aria-label="Fechar janela">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </motion.div>
    </dialog>
  );
}
