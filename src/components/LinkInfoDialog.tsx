import { CalendarDays, Clock3, ExternalLink, FolderTree, Globe2, Info } from 'lucide-react';
import type { ChartLink, FolderNode } from '../types/chartlink';
import { AppDialog } from './AppDialog';
import { displayLinkHost, formatLinkDate, resolveLinkUrl } from '../utils/linkUrl';

interface LinkInfoDialogProps {
  link: ChartLink;
  folders: ReadonlyMap<number, FolderNode>;
  onClose: () => void;
}

export function LinkInfoDialog({ link, folders, onClose }: LinkInfoDialogProps) {
  const href = resolveLinkUrl(link.url);
  const paths = link.folderIds.map(id => folders.get(id)?.path).filter((path): path is string[] => !!path);
  const locations = paths.length ? paths : link.folderPaths.length ? link.folderPaths : [[link.category, link.subcategory].filter(Boolean)];
  return (
    <AppDialog title="Informações do link" onClose={onClose}>
      <h3 className="chartlink-link-title text-lg mb-4">{link.title}</h3>
      <dl className="space-y-4 text-sm">
        <div><dt className="chartlink-info-label"><CalendarDays size={15} /> Criado em</dt>
          <dd className="mt-1 text-zinc-900">{formatLinkDate(link.createdAt)}</dd></div>
        <div><dt className="chartlink-info-label"><Clock3 size={15} /> Última edição registrada</dt>
          <dd className="mt-1 text-zinc-900">{link.updatedAt == null ? 'Nenhuma edição registrada' : formatLinkDate(link.updatedAt)}</dd>
          {link.updatedAt == null && <p className="mt-1 text-xs text-zinc-500">O histórico de edições anteriores a esta versão não está disponível.</p>}</div>
        <div><dt className="chartlink-info-label"><Globe2 size={15} /> Endereço · {displayLinkHost(link.url)}</dt>
          <dd className="mt-1 break-all text-zinc-900">{link.url}</dd></div>
        <div><dt className="chartlink-info-label"><FolderTree size={15} /> Categorias e subcategorias</dt>
          <dd className="flex flex-wrap gap-2 mt-2">{locations.map((path, index) => (
            <span key={`${index}:${path.join('/')}`} className="chartlink-info-tag">{path.join(' / ') || 'Sem categoria'}</span>
          ))}</dd></div>
        <div><dt className="chartlink-info-label"><Info size={15} /> Descrição</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-zinc-700">{link.description?.trim() || 'Sem descrição cadastrada.'}</dd></div>
      </dl>
      {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white">
        <ExternalLink size={16} /> Abrir em nova aba
      </a>}
    </AppDialog>
  );
}
