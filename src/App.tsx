import { useState, useEffect, useMemo, type FormEvent, type ChangeEvent, type DragEvent as ReactDragEvent } from 'react';
import './chartlink-modern.css';
import type { ChartLink, FolderNode, Subcategory, ViewMode, SortOrder } from './types/chartlink';
import { categoryColor, getCategoryStyle, hexToRgba, resolveFolderColor } from './styles/categoryStyles';
import { AnimatedSidebar, clampSidebarWidth, SIDEBAR_DEFAULT_WIDTH } from './components/AnimatedSidebar';
import { LinkCollection } from './components/LinkCollection';
import { FolderColorDialog } from './components/FolderColorDialog';
import { CategoryFolderIcon } from './components/CategoryFolderIcon';
import { FolderActionsMenu } from './components/FolderActionsMenu';
import { LinkInfoDialog } from './components/LinkInfoDialog';
import { useLinkSearch } from './hooks/useLinkSearch';
import { LinkSearchInput } from './components/LinkSearchInput';
import { ThemeSelector } from './components/ThemeSelector';
import { AuthDialog } from './components/AuthDialog';
import { UserMenu } from './components/UserMenu';
import { TrashDialog } from './components/TrashDialog';
import { AdminUsersDialog } from './components/AdminUsersDialog';
import { useTheme } from './hooks/useTheme';
import { scopeLinks, sortLinks } from './utils/linkView';
import { resolveLinkUrl } from './utils/linkUrl';
import { createTemporaryId } from './utils/temporaryId';
import { apiRequest as fetch, loadAuthSession, updateAuthSession } from './api/client';
import type { AuthSession } from './types/auth';
import { UNCLASSIFIED_CATEGORY, UNCLASSIFIED_CATEGORY_COLOR } from './constants/categories';
import {
  Plus, Trash2, ExternalLink, LayoutGrid, List,
  Link as LinkIcon, X, Edit2, Settings, Check,
  Upload, FileText, AlertCircle,
  Tag, FolderOpen, Folder, CheckSquare, Square, ArrowRightLeft,
  ChevronRight, ChevronDown, FolderPlus, CopyPlus, Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseBookmarkHtml, type ParsedBookmark } from './bookmarks/bookmarkParser';
import { classifyBookmarks, type ClassifiedBookmark } from './bookmarks/bookmarkClassifier';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

function rowToLink(row: Record<string, unknown>): ChartLink {
  return {
    id: row.id as string,
    title: row.title as string,
    url: row.url as string,
    category: row.category as string,
    subcategory: (row.subcategory as string) || '',
    description: (row.description as string) || '',
    createdAt: (row.created_at as number) ?? (row.createdAt as number),
    updatedAt: (row.updated_at as number | null) ?? (row.updatedAt as number | null) ?? null,
    folderId: (row.folder_id as number) ?? null,
    folderPath: (row.folder_path as string[]) || [],
    folderIds: (row.folder_ids as number[]) || ((row.folder_id as number) ? [row.folder_id as number] : []),
    folderPaths: (row.folder_paths as string[][]) || [],
    folderTags: (row.folder_tags as string[]) || [],
    folderTagItems: (row.folder_tag_items as { id: number | null; name: string; level: number; path: string[] }[]) || [],
  };
}

const API = '/api';


const folderColor = (level: number, rootName?: string, customColor?: string, dark = false) => {
  const color = customColor || categoryColor(rootName);
  const isColored = customColor !== undefined || color !== '#000000';
  const foreground = dark ? '#f4f4f5' : '#000000';
  return {
    color,
    badgeStyle: {
      color: foreground,
      backgroundColor: isColored ? hexToRgba(color, dark ? 0.3 : 0.13) : (dark ? '#34383d' : '#f4f4f5'),
    },
    tagStyle: { color: foreground, backgroundColor: hexToRgba(color, dark ? 0.28 : 0.16), borderColor: hexToRgba(color, 0.55) },
    pillActiveStyle: {
      backgroundColor: hexToRgba(color, dark ? 0.34 : 0.22),
      border: '1.5px solid ' + hexToRgba(color, dark ? 0.75 : 0.5),
      color: foreground,
    },
    pillInactiveStyle: {
      borderColor: isColored ? hexToRgba(color, 0.5) : '#d4d4d8',
      color: foreground,
    },
  };
};

// ---------------------------------------------------------------------------
// Importação inteligente de favoritos
// ---------------------------------------------------------------------------

interface ImportPreviewItem extends ClassifiedBookmark {
  temporaryId: string;
  description: string;
  createdAt: number;
}

interface LinkImportPayload {
  title: string;
  url: string;
  category: string;
  subcategory: string;
  description: string;
  createdAt: number;
  folderId: number | null;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const { preference: themePreference, resolved: resolvedTheme, setPreference: setThemePreference } = useTheme();
  const [links, setLinks]           = useState<ChartLink[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const folderById = useMemo(() => new Map(folders.map(folder => [folder.id, folder])), [folders]);
  const categoryCount = useMemo(() => folders.filter(folder => folder.parent_id === null).length, [folders]);
  const rootCategoryNames = useMemo(
  () => folders
    .filter(folder => folder.parent_id === null)
    .map(folder => folder.name)
    .sort((a, b) =>
      a.localeCompare(b, 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
      }),
    ),
  [folders],
);
  const subcategoryCount = folders.length - categoryCount;
  const [loading, setLoading]       = useState(true);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const canAssignLinkCategory =
  auth?.permissions.assignLinkCategory === true;
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);

  // Filtros
  const [filterCategory, setFilterCategory]       = useState<string>('Todos');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery]             = useState('');
  const [regexEnabled, setRegexEnabled] = useState(false);
  const [viewMode, setViewMode]                   = useState<ViewMode>('grid');
  const [sortOrder, setSortOrder]                 = useState<SortOrder>('recent');
  const [selectedLinkIds, setSelectedLinkIds]     = useState<Set<string>>(new Set());

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      return clampSidebarWidth(Number(localStorage.getItem('chartlink.sidebarWidth') || SIDEBAR_DEFAULT_WIDTH));
    } catch {
      return SIDEBAR_DEFAULT_WIDTH;
    }
  });
  const [resizingSidebar, setResizingSidebar] = useState(false);
  // Árvore de categorias/subcategorias: cada nível pode ser expandido
  // independentemente, sem alterar a taxonomia existente do banco.
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);

  // Modais
  const [colorFolderId, setColorFolderId] = useState<number | null>(null);
  const colorFolder = colorFolderId === null ? undefined : folderById.get(colorFolderId);
  const [infoLinkId, setInfoLinkId] = useState<string | null>(null);
  const infoLink = links.find(link => link.id === infoLinkId);
  const [isModalOpen, setIsModalOpen]                 = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen]     = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen]     = useState(false);
  const [linkToDelete, setLinkToDelete]               = useState<string | null>(null);
  const [isBulkMoveOpen, setIsBulkMoveOpen]             = useState(false);
  const [bulkMoveMode, setBulkMoveMode] = useState<'move' | 'copy'>('move');
  const [isFolderModalOpen, setIsFolderModalOpen]         = useState(false);
  const [folderParentId, setFolderParentId]               = useState<number | null>(null);
  const [newFolderName, setNewFolderName]                 = useState('');
  const [bulkMoveCategory, setBulkMoveCategory]         = useState('');
  const [bulkMoveSubcategory, setBulkMoveSubcategory]   = useState('');
  const [bulkMoveFolderId, setBulkMoveFolderId]         = useState<number | null>(null);
  const [draggingLinkId, setDraggingLinkId]             = useState<string | null>(null);
  const [draggingFolderId, setDraggingFolderId]         = useState<number | null>(null);
  const [dropFolderId, setDropFolderId]                 = useState<number | null>(null);
  const [treeDeleteTarget, setTreeDeleteTarget]         = useState<FolderNode | null>(null);
  const [isTreeDeleteModalOpen, setIsTreeDeleteModalOpen] = useState(false);
  const [importMode, setImportMode]                   = useState<'csv' | 'firefox'>('csv');

  // Gerenciar categorias
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [activeCatTab, setActiveCatTab]       = useState<string>('');
  const [newSubcatName, setNewSubcatName]     = useState('');
  const [managerFolderId, setManagerFolderId] = useState<number | null>(null);

  // Import
  const [importError, setImportError] = useState<string | null>(null);
  const [bookmarkPreview, setBookmarkPreview] = useState<ImportPreviewItem[]>([]);
  const [bookmarkSourceName, setBookmarkSourceName] = useState('');
  const [bookmarkReview, setBookmarkReview] = useState(false);

  // Share
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form de link
  const [editingLink, setEditingLink] = useState<ChartLink | null>(null);
  const [linkFormError, setLinkFormError] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '', url: '', category: 'Geral', subcategory: '', description: '', folderId: null as number | null,
  });

  // -------------------------------------------------------------------------
  // Carrega dados
  // -------------------------------------------------------------------------

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const authSession = await loadAuthSession();
        setAuth(authSession);
          const [linksRes, catsRes, subsRes, foldersRes] = await Promise.all([
          fetch(API + '/links'),
          fetch(API + '/categories'),
          fetch(API + '/subcategories'),
          fetch(API + '/folders'),
        ]);
        setLinks((await linksRes.json()).map(rowToLink));
        const cats = await catsRes.json();
        setCategories(cats);
        setSubcategories(await subsRes.json());
        setFolders(await foldersRes.json());
        if (cats.length > 0) setActiveCatTab(cats[0]);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const requestLogin = () => setIsLoginOpen(true);
    const requestPasswordChange = () => setIsPasswordOpen(true);
    window.addEventListener('chartlink:auth-required', requestLogin);
    window.addEventListener('chartlink:password-change-required', requestPasswordChange);
    return () => {
      window.removeEventListener('chartlink:auth-required', requestLogin);
      window.removeEventListener('chartlink:password-change-required', requestPasswordChange);
    };
  }, []);

  const acceptAuthSession = (next: AuthSession) => {
    setAuth(next);
    setIsLoginOpen(false);
    };

  const requireAuthenticated = () => {
    if (auth?.authenticated) return true;
    setIsLoginOpen(true);
    return false;
  };

  const logout = async () => {
    const response = await fetch(API + '/auth/logout', { method: 'POST' });
    if (!response.ok) return;
    const next = updateAuthSession(await response.json() as AuthSession);
    setAuth(next);
    setSelectedLinkIds(new Set());
    setIsTrashOpen(false); setIsUsersOpen(false); setIsPasswordOpen(false);
  };

  const saveFolderColor = async (color: string | null) => {
    if (!colorFolder) throw new Error('Pasta não encontrada.');
    const response = await fetch(`${API}/folders/${colorFolder.id}/color`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color }),
    });
    const payload = await response.json() as FolderNode & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar a cor.');
    setFolders(current => current.map(folder => folder.id === payload.id ? { ...folder, ...payload } : folder));
  };

  const refreshFolders = async () => {
    const res = await fetch(API + '/folders');
    if (res.ok) setFolders(await res.json());
  };

  useEffect(() => {
    if (!resizingSidebar) return;
    const onMove = (e: MouseEvent) => {
      const width = clampSidebarWidth(e.clientX);
      setSidebarWidth(width);
    };
    const onUp = () => setResizingSidebar(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizingSidebar]);

  useEffect(() => {
    try {
      localStorage.setItem('chartlink.sidebarWidth', String(sidebarWidth));
    } catch {
      // A barra continua utilizável quando o armazenamento está indisponível.
    }
  }, [sidebarWidth]);

  useEffect(() => {
    if (!sidebarOpen) setResizingSidebar(false);
  }, [sidebarOpen]);

  // -------------------------------------------------------------------------
  // Filtros
  // -------------------------------------------------------------------------

  const visibleSubcats = useMemo(() =>
    subcategories.filter(s => s.category === filterCategory),
    [subcategories, filterCategory]
  );

  const toggleFolder = (key: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectCategory = (cat: string) => {
    setSearchQuery('');
    setSelectedFolderId(null);
    setFilterCategory(cat);
    setFilterSubcategory('Todas');
  };

  const handleSelectSubcategory = (subcategory: string) => {
    setSearchQuery('');
    // Os atalhos superiores pertencem à raiz da categoria, mesmo quando
    // estávamos em uma pasta mais profunda da árvore.
    const root = folders.find(folder => folder.parent_id === null && folder.name === filterCategory);
    const child = subcategory === 'Todas' ? undefined
      : folders.find(folder => folder.parent_id === root?.id && folder.name === subcategory);
    setSelectedFolderId(child?.id ?? root?.id ?? null);
    setFilterSubcategory(subcategory);
  };

  const scopedLinks = useMemo(() => scopeLinks(links, folderById, {
    folderId: selectedFolderId, category: filterCategory, subcategory: filterSubcategory,
  }), [links, folderById, selectedFolderId, filterCategory, filterSubcategory]);
  const search = useLinkSearch(scopedLinks, folderById, searchQuery, regexEnabled);
  const filteredLinks = useMemo(() => sortLinks(
    search.ids === null ? scopedLinks : scopedLinks.filter(link => search.ids?.has(link.id)), sortOrder,
  ), [scopedLinks, search.ids, sortOrder]);
  const selectedPath = selectedFolderId === null ? undefined : folderById.get(selectedFolderId)?.path;
  const activeSubcategory = filterSubcategory === 'Todas' ? selectedPath?.[1] || 'Todas' : filterSubcategory;
  const scopeLabel = (selectedFolderId !== null
    ? selectedPath?.join(' / ') || filterCategory
    : filterCategory === 'Todos' ? 'Todos os links' : filterCategory)
    + (filterSubcategory === 'Todas' || selectedPath?.[1] === filterSubcategory ? '' : ` / ${filterSubcategory}`);

  const allVisibleSelected = filteredLinks.length > 0 && filteredLinks.every(l => selectedLinkIds.has(l.id));
  const selectedCount = selectedLinkIds.size;
  const bulkMoveFolder = useMemo(() =>
    folders.find(f => f.id === bulkMoveFolderId) || null,
    [folders, bulkMoveFolderId]
  );

  const toggleLinkSelection = (id: string) => {
    setSelectedLinkIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectVisible = () => {
    setSelectedLinkIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredLinks.forEach(l => next.delete(l.id));
      else filteredLinks.forEach(l => next.add(l.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedLinkIds(new Set());

  const openNewFolder = (parentId: number | null) => {
    if (!requireAuthenticated()) return;
    setFolderParentId(parentId);
    setNewFolderName('');
    setIsFolderModalOpen(true);
  };

  const createFolder = async (e: FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const res = await fetch(API + '/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: folderParentId }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Não foi possível criar a categoria/subcategoria.'); return; }
  const created = await res.json() as FolderNode;

  setFolders(prev => [...prev, created]);

  if (folderParentId === null) {
    setCategories(prev => {
      if (prev.includes(created.name)) {
        return prev;
      }

    return [...prev, created.name].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  });

  setActiveCatTab(created.name);
}
  
    setExpandedFolders(prev => { const next = new Set(prev); if (folderParentId !== null) next.add('folder:' + folderParentId); return next; });
    setIsFolderModalOpen(false);
    setNewFolderName('');
  };

  const selectFolderNode = (folder: FolderNode) => {
    setSearchQuery('');
    setSelectedFolderId(folder.id);
    setFilterCategory(folder.path[0] || 'Todos');
    // A árvore pode ter profundidade arbitrária. O filtro pelo nível selecionado já inclui
    // todos os descendentes, portanto não devemos restringi-lo ao segundo nível.
    setFilterSubcategory('Todas');
  };

  const openLinkInFolder = (folderId: number) => {
    setEditingLink(null);
    setLinkFormError(null);

    if (!canAssignLinkCategory) {
      setFormData({
        title: '',
        url: '',
        category: UNCLASSIFIED_CATEGORY,
        subcategory: '',
        description: '',
        folderId: null,
      });

      setIsModalOpen(true);
      return;
    }

    const folder = folders.find(item => item.id === folderId);
    const category =
      folder?.path[0] || categories[0] || UNCLASSIFIED_CATEGORY;
    const subcategory = folder?.path[1] || '';

    setFormData({
      title: '',
      url: '',
      category,
      subcategory,
      description: '',
      folderId,
    });

    setIsModalOpen(true);
  };



  // -------------------------------------------------------------------------
  // Share
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (copiedId) {
      const t = setTimeout(() => setCopiedId(null), 2000);
      return () => clearTimeout(t);
    }
  }, [copiedId]);

  const handleShare = async (link: ChartLink) => {
    const text = link.url;
    const copied = () => setCopiedId(link.id);
    // Clipboard API moderna (requer HTTPS ou localhost)
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); copied(); return; } catch {}
    }
    // Fallback via execCommand (funciona em HTTP)
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      if (document.execCommand('copy')) copied();
      document.body.removeChild(ta);
    } catch (e) { console.error('Clipboard fallback failed', e); }
  };

  // -------------------------------------------------------------------------
  // CRUD Links
  // -------------------------------------------------------------------------

  const handleAddOrEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.url || linkSaving) return;
    setLinkFormError(null);
    setLinkSaving(true);
    try {
      if (editingLink) {
        const res = await fetch(API + '/links/' + editingLink.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Não foi possível atualizar o link.');
        }
        const updated = rowToLink(await res.json());
        setLinks(prev => prev.map(l => l.id === updated.id ? updated : l));
      } else {
        const payload = {
          title: formData.title,
          url: formData.url,
          category: canAssignLinkCategory ? formData.category : UNCLASSIFIED_CATEGORY,
          subcategory: canAssignLinkCategory ? formData.subcategory : '',
          description: formData.description,
          folderId: canAssignLinkCategory ? formData.folderId : null,
          createdAt: Date.now(),
        };
        const res = await fetch(API + '/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const response = await res.json().catch(() => ({}));
          throw new Error(response.error || 'Não foi possível adicionar o link.');
        }
        const created = rowToLink(await res.json());
        setLinks(prev => [created, ...prev]);
      }
      closeModal();
    } catch (error) {
      console.error(error);
      setLinkFormError(error instanceof Error ? error.message : 'Não foi possível salvar o link.');
    } finally {
      setLinkSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!linkToDelete) return;
    const res = await fetch(API + '/links/' + linkToDelete, { method: 'DELETE' });
    if (!res.ok) return;
    setLinks(prev => prev.filter(l => l.id !== linkToDelete));
    setSelectedLinkIds(prev => { const next = new Set(prev); next.delete(linkToDelete); return next; });
    setIsDeleteModalOpen(false);
    setLinkToDelete(null);
  };

  useEffect(() => {
    if (!isDeleteModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') { event.preventDefault(); void confirmDelete(); }
      if (event.key === 'Escape') { event.preventDefault(); setIsDeleteModalOpen(false); setLinkToDelete(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDeleteModalOpen, linkToDelete]);

  const bulkDelete = async () => {
    if (!selectedCount) return;
    if (!requireAuthenticated()) return;
    if (!window.confirm(`Enviar ${selectedCount} link${selectedCount === 1 ? '' : 's'} selecionado${selectedCount === 1 ? '' : 's'} para a lixeira?`)) return;
    const ids = Array.from(selectedLinkIds);
    const res = await fetch(API + '/links/bulk-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', ids }),
    });
    if (!res.ok) return;
    setLinks(prev => prev.filter(l => !selectedLinkIds.has(l.id)));
    clearSelection();
  };

  const refreshLinksAndFolders = async () => {
    const [lr, fr] = await Promise.all([fetch(API + '/links'), fetch(API + '/folders')]);
    if (lr.ok) setLinks((await lr.json()).map(rowToLink));
    if (fr.ok) setFolders(await fr.json());
  };

  const applyAffectedLinks = (rows: unknown[]) => {
    const updated = rows.map(r => rowToLink(r as Record<string, unknown>));
    const byId = new Map(updated.map(l => [l.id, l]));
    setLinks(prev => prev.map(l => byId.get(l.id) || l));
  };

  const moveLinksToFolder = async (ids: string[], folderId: number) => {
    const uniqueIds = Array.from(new Set(ids));
    const res = await fetch(API + '/links/bulk-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', ids: uniqueIds, folderId }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Não foi possível mover os links.'); return false; }
    const payload = await res.json();
    if (payload.links) applyAffectedLinks(payload.links);
    await refreshFolders();
    return true;
  };

  const copyLinksToFolder = async (ids: string[], folderId: number) => {
    const uniqueIds = Array.from(new Set(ids));
    const res = await fetch(API + '/links/bulk-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copy', ids: uniqueIds, folderId }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Não foi possível enviar os links como cópia.'); return false; }
    const payload = await res.json();
    if (payload.links) applyAffectedLinks(payload.links);
    await refreshFolders();
    return true;
  };

  const openCopyForLinks = (ids: string[]) => {
    if (!requireAuthenticated()) return;
    const initialFolder = selectedFolderId ?? folders.find(f => f.parent_id === null)?.id ?? null;
    const initial = folders.find(f => f.id === initialFolder);
    setBulkMoveMode('copy');
    setBulkMoveFolderId(initialFolder);
    setBulkMoveCategory(initial?.path[0] || filterCategory || categories[0] || '');
    setBulkMoveSubcategory(initial?.path[initial.path.length - 1] || '');
    setSelectedLinkIds(new Set(ids));
    setIsBulkMoveOpen(true);
  };

  const bulkCopy = async () => {
    if (!selectedCount || bulkMoveFolderId === null) return;
    const ok = await copyLinksToFolder(Array.from(selectedLinkIds), bulkMoveFolderId);
    if (!ok) return;
    setIsBulkMoveOpen(false); setBulkMoveFolderId(null); clearSelection();
  };

  const bulkMove = async () => {
    if (!selectedCount || bulkMoveFolderId === null) return;
    const ok = bulkMoveMode === 'copy'
      ? await copyLinksToFolder(Array.from(selectedLinkIds), bulkMoveFolderId)
      : await moveLinksToFolder(Array.from(selectedLinkIds), bulkMoveFolderId);
    if (!ok) return;
    setIsBulkMoveOpen(false); setBulkMoveFolderId(null);
    setBulkMoveCategory(''); setBulkMoveSubcategory(''); clearSelection();
  };

  const moveFolderToFolder = async (folderId: number, parentId: number) => {
    if (folderId === parentId) return;
    const res = await fetch(API + '/folders/' + folderId + '/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Não foi possível mover a categoria/subcategoria.'); return false; }
    const payload = await res.json();
    if (payload.links) applyAffectedLinks(payload.links);
    await refreshFolders();
    return true;
  };

  const handleLinkDragStart = (e: ReactDragEvent, link: ChartLink) => {
    const ids = selectedLinkIds.has(link.id) && selectedCount > 1 ? Array.from(selectedLinkIds) : [link.id];
    setDraggingLinkId(link.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/chartlink-ids', JSON.stringify(ids));
    e.dataTransfer.setData('text/chartlink-id', link.id);
  };

  const handleFolderDragStart = (e: ReactDragEvent, folder: FolderNode) => {
    setDraggingFolderId(folder.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/chartlink-folder-id', String(folder.id));
  };

  const clearDragState = () => { setDraggingLinkId(null); setDraggingFolderId(null); setDropFolderId(null); };

  const handleFolderDrop = async (e: ReactDragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceFolder = e.dataTransfer.getData('text/chartlink-folder-id');
    const idsRaw = e.dataTransfer.getData('text/chartlink-ids');
    const single = e.dataTransfer.getData('text/chartlink-id');
    clearDragState();
    if (sourceFolder) { await moveFolderToFolder(Number(sourceFolder), folderId); return; }
    let ids: string[] = [];
    try { ids = idsRaw ? JSON.parse(idsRaw) : (single ? [single] : []); } catch { ids = single ? [single] : []; }
    if (ids.length) { await moveLinksToFolder(ids, folderId); setSelectedLinkIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; }); }
  };

  const openModal = (link?: ChartLink) => {
    if (link && !requireAuthenticated()) return;
    setLinkFormError(null);
    if (link) {
      setEditingLink(link);
      setFormData({
        title: link.title, url: link.url, category: link.category,
        subcategory: link.subcategory, description: link.description || '', folderId: link.folderId,
      });
    } else {
      setEditingLink(null);
      const destination =
  selectedFolderId !== null && canAssignLinkCategory
    ? folderById.get(selectedFolderId)
    : undefined;      
      setFormData({
        title: '', url: '',
        category: canAssignLinkCategory ? destination?.path[0] || UNCLASSIFIED_CATEGORY : UNCLASSIFIED_CATEGORY, 
        subcategory: canAssignLinkCategory ? destination?.path[1] || '' : '',
        description: '',
        folderId: canAssignLinkCategory ? selectedFolderId : null,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingLink(null); setLinkFormError(null); };

  // -------------------------------------------------------------------------
  // CRUD Categorias
  // -------------------------------------------------------------------------

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name || rootCategoryNames.includes(name)) return;
      const res = await fetch(API + '/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name }),
    });
    if (!res.ok) return;
    setCategories(prev => [...prev, name]);
    setNewCategoryName('');
    setActiveCatTab(name);
    setManagerFolderId(null);
    await refreshFolders();
  };

  const deleteCategory = async (cat: string) => {
    const count = links.filter(l => l.category === cat).length;
    const message = count
      ? `Excluir "${cat}"? ${count} link${count === 1 ? '' : 's'} ficará${count === 1 ? '' : 'ão'} em "${UNCLASSIFIED_CATEGORY}". Nenhum link será transferido para outra categoria.`
      : `Excluir "${cat}"?`;
    if (!window.confirm(message)) return;
    const res = await fetch(API + '/categories/' + encodeURIComponent(cat), { method: 'DELETE' });
    if (!res.ok) return;
    setLinks(prev => prev.map(l => l.category === cat ? { ...l, category: UNCLASSIFIED_CATEGORY, subcategory: '' } : l));
    setSubcategories(prev => prev.filter(s => s.category !== cat));
    setCategories(prev => prev.filter(c => c !== cat));
    await refreshFolders();
    if (filterCategory === cat) handleSelectCategory('Todos');
    setActiveCatTab(categories.find(c => c !== cat) || '');
    setManagerFolderId(null);
  };

  const saveCategoryEdit = async () => {
    if (!editingCategory) return;
    const { oldName } = editingCategory;
    const newName = editingCategory.newName.trim();
    if (!newName || newName === oldName) { setEditingCategory(null); return; }
    if (rootCategoryNames.includes(newName)) { alert('Esta categoria ja existe.'); return; }
    const res = await fetch(API + '/categories/' + encodeURIComponent(oldName), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: newName }),
    });
    if (!res.ok) return;
    setCategories(prev => prev.map(c => c === oldName ? newName : c));
    setSubcategories(prev => prev.map(s => s.category === oldName ? { ...s, category: newName } : s));
    setLinks(prev => prev.map(l => l.category === oldName ? { ...l, category: newName } : l));
    if (filterCategory === oldName) setFilterCategory(newName);
    if (activeCatTab === oldName) setActiveCatTab(newName);
    await refreshFolders();
    setManagerFolderId(null);
    setEditingCategory(null);
  };

  // -------------------------------------------------------------------------
  // Gerenciamento hierárquico de categorias/subcategorias pelo modal de Categorias
  // -------------------------------------------------------------------------

  const managerRoot = useMemo(
    () => folders.find(f => f.parent_id === null && f.name === activeCatTab) || null,
    [folders, activeCatTab]
  );

  useEffect(() => {
    if (!activeCatTab) {
      setManagerFolderId(null);
      return;
    }
    const root = folders.find(f => f.parent_id === null && f.name === activeCatTab);
    if (!root) {
      setManagerFolderId(null);
      return;
    }
    const selected = folders.find(f => f.id === managerFolderId);
    if (!selected || selected.path[0] !== activeCatTab) setManagerFolderId(root.id);
  }, [activeCatTab, folders, managerFolderId]);

  const managerChildren = (parentId: number) => folders
    .filter(f => f.parent_id === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  const managerDescendantIds = (folderId: number) => {
    const ids = new Set<number>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach(f => {
        if (f.parent_id !== null && ids.has(f.parent_id) && !ids.has(f.id)) {
          ids.add(f.id);
          changed = true;
        }
      });
    }
    return ids;
  };

  const managerLinkCount = (folderId: number) => {
    const ids = managerDescendantIds(folderId);
    return links.filter(l => l.folderIds.some(fid => ids.has(fid))).length;
  };

  const createManagerSubfolder = async (e: FormEvent) => {
    e.preventDefault();
    const name = newSubcatName.trim();
    if (!name || !managerFolderId) return;
    const res = await fetch(API + '/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: managerFolderId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Não foi possível criar a subcategoria.');
      return;
    }
    const created = await res.json() as FolderNode;
    setFolders(prev => [...prev, created]);
    setNewSubcatName('');
    // Mantém o foco no destino anterior: o novo nó é irmão dos próximos nós criados.
    setManagerFolderId(created.parent_id ?? managerFolderId);
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.add('folder:' + (created.parent_id as number));
      next.add('manager:' + (created.parent_id as number));
      return next;
    });
  };

  const renameManagerFolder = async (folder: FolderNode) => {
    const name = window.prompt('Novo nome da categoria/subcategoria:', folder.name)?.trim();
    if (!name || name === folder.name) return;
    const res = await fetch(API + '/folders/' + folder.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Não foi possível renomear a categoria/subcategoria.');
      return;
    }
    const updated = await res.json() as FolderNode;
    setFolders(prev => prev.map(f => f.id === updated.id ? updated : f));
  };

  const deleteManagerFolder = async (folder: FolderNode) => {
    const count = managerLinkCount(folder.id);
    const message = count
      ? `Excluir "${folder.name}" e suas subcategorias? ${count} link${count === 1 ? '' : 's'} ficará${count === 1 ? '' : 'ão'} em "${UNCLASSIFIED_CATEGORY}".`
      : `Excluir "${folder.name}" e suas subcategorias?`;
    if (!window.confirm(message)) return;
    const res = await fetch(API + '/folders/' + folder.id, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Não foi possível excluir a categoria/subcategoria.'); return; }
    const payload = await res.json();
    const ids = managerDescendantIds(folder.id);
    if (payload.links) {
      const changed: ChartLink[] = payload.links.map((r: unknown) => rowToLink(r as Record<string, unknown>));
      setLinks(prev => prev.map(l => changed.find(c => c.id === l.id) || l));
    }
    await refreshFolders();
    const catsRes = await fetch(API + '/categories');
    if (catsRes.ok) setCategories(await catsRes.json());
    if (managerFolderId !== null && ids.has(managerFolderId)) {
      setManagerFolderId(folder.parent_id ?? managerRoot?.id ?? null);
    }
    if (selectedFolderId !== null && ids.has(selectedFolderId)) {
      setSelectedFolderId(folder.parent_id ?? null);
      setFilterSubcategory('Todas');
    }
  };

  const requestTreeDelete = (folder: FolderNode) => {
    if (!auth?.permissions.manageUsers) {
      if (!auth?.authenticated) setIsLoginOpen(true);
      else alert('Somente administradores podem excluir categorias e subcategorias.');
      return;
    }
    setTreeDeleteTarget(folder);
    setIsTreeDeleteModalOpen(true);
  };

  const confirmTreeDelete = async () => {
    const folder = treeDeleteTarget;
    if (!folder) return;
    const ids = managerDescendantIds(folder.id);
    const res = await fetch(API + '/folders/' + folder.id, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Não foi possível excluir a categoria/subcategoria.'); return; }
    const payload = await res.json();
    if (payload.links) {
      const changed: ChartLink[] = payload.links.map((r: unknown) => rowToLink(r as Record<string, unknown>));
      setLinks(prev => prev.map(l => changed.find(c => c.id === l.id) || l));
    }
    await refreshFolders();
    const catsRes = await fetch(API + '/categories');
    if (catsRes.ok) setCategories(await catsRes.json());
    if (selectedFolderId !== null && ids.has(selectedFolderId)) {
      setSelectedFolderId(folder.parent_id ?? null);
      setFilterSubcategory('Todas');
    }
    if (managerFolderId !== null && ids.has(managerFolderId)) setManagerFolderId(folder.parent_id ?? managerRoot?.id ?? null);
    setIsTreeDeleteModalOpen(false);
    setTreeDeleteTarget(null);
  };

  const hierarchyLabel = (level: number) =>
    level === 0 ? 'Categoria' : `Subcategoria ${level}`;

  const renderManagerFolder = (folder: FolderNode, depth = 0): JSX.Element => {
    const children = managerChildren(folder.id);
    const selected = managerFolderId === folder.id;
    const expanded = expandedFolders.has('manager:' + folder.id);
    return (
      <div key={folder.id} className="select-none">
        <div
          className={'group relative flex items-center gap-1 p-2 rounded-xl transition-all ' +
            (selected ? 'bg-emerald-50 ring-1 ring-emerald-100' : 'bg-zinc-50 hover:bg-zinc-100')}
          style={{ marginLeft: depth * 14 }}
        >
          <button
            type="button"
            onClick={() => setExpandedFolders(prev => {
              const next = new Set(prev);
              const key = 'manager:' + folder.id;
              if (next.has(key)) next.delete(key); else next.add(key);
              return next;
            })}
            className="p-1 text-zinc-400 hover:text-zinc-700 shrink-0"
            title={expanded ? 'Recolher' : 'Expandir'}
          >
            {children.length > 0
              ? (expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
              : <span className="inline-block w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setManagerFolderId(folder.id)}
            className="flex-1 min-w-0 flex items-center gap-2 text-left"
            title={folder.path.join(' / ')}
          >
            <CategoryFolderIcon open={expanded} color={resolveFolderColor(folder.id, folderById)} />
            <span className={'chartlink-folder-label truncate text-xs ' + (selected ? 'font-bold' : 'font-medium')}>{folder.name}</span>
            <span className="text-[10px] text-zinc-400 shrink-0">({managerLinkCount(folder.id)})</span>
          </button>
          <FolderActionsMenu
            folderName={folder.name}
            onColor={auth?.permissions.manageFolders ? () => setColorFolderId(folder.id) : undefined}
            onSelectDestination={() => setManagerFolderId(folder.id)}
            onRename={() => void renameManagerFolder(folder)}
            onDelete={auth?.permissions.manageUsers ? () => requestTreeDelete(folder) : undefined}
          />
        </div>
        {expanded && children.length > 0 && (
          <div className="ml-3 pl-2 border-l border-zinc-200 mt-1 space-y-1">
            {children.map(child => renderManagerFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Importar CSV
  // -------------------------------------------------------------------------

  const handleCsvImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) throw new Error('CSV vazio ou mal formatado.');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const idx = (keys: string[]) => { for (const k of keys) { const i = headers.indexOf(k); if (i !== -1) return i; } return -1; };
        const titleIdx = idx(['titulo','title','título']);
        const urlIdx   = idx(['url','link']);
        const catIdx   = idx(['categoria','category']);
        const subIdx   = idx(['subcategoria','subcategory']);
        const descIdx  = idx(['descricao','description','descrição']);
        if (titleIdx === -1 || urlIdx === -1) throw new Error('Colunas Titulo e URL sao obrigatorias.');
        const newLinks: LinkImportPayload[] = [];
        const newCats = new Set(categories);
        const newSubs: { name: string; category: string }[] = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].trim().split(',').map(v => v.trim());
          const title = vals[titleIdx]; const url = vals[urlIdx];
          if (!title || !url) continue;
          const cat = catIdx !== -1 && vals[catIdx] ? vals[catIdx] : 'Geral';
          const sub = subIdx !== -1 ? (vals[subIdx] || '') : '';
          const desc = descIdx !== -1 ? (vals[descIdx] || '') : '';
          newLinks.push({ title, url, category: cat, subcategory: sub, description: desc, createdAt: Date.now() - i, folderId: null });
          newCats.add(cat);
          if (sub && !subcategories.some(s => s.category === cat && s.name === sub))
            newSubs.push({ name: sub, category: cat });
        }
        if (newLinks.length === 0) throw new Error('Nenhum link valido encontrado.');
        const res = await fetch(API + '/links/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            links: newLinks,
            categories: Array.from(newCats).filter(c => !categories.includes(c)),
            subcategories: newSubs,
          }),
        });
        if (!res.ok) throw new Error('Falha ao importar no servidor.');
        const refreshedLinks = await (await fetch(API + '/links')).json();
        const refreshedFolders = await (await fetch(API + '/folders')).json();
        setLinks(refreshedLinks.map(rowToLink));
        setFolders(refreshedFolders);
        setCategories(Array.from(newCats));
        setSubcategories(prev => {
          const existing = new Set(prev.map(s => s.category + '::' + s.name));
          const toAdd = newSubs.filter(s => !existing.has(s.category + '::' + s.name));
          return [...prev, ...toAdd.map((s, i) => ({ id: Date.now() + i, ...s }))];
        });
        setIsImportModalOpen(false);
        alert(newLinks.length + ' links importados!');
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Erro ao processar CSV.');
      }
    };
    reader.onerror = () => setImportError('Erro ao ler o arquivo.');
    reader.readAsText(file);
    e.target.value = '';
  };

  // -------------------------------------------------------------------------
  // Importar Favoritos HTML (classificação inteligente)
  // -------------------------------------------------------------------------

  const prepareBookmarkImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const html = event.target?.result as string;
        const parsed = parseBookmarkHtml(html);
        if (parsed.bookmarks.length === 0) throw new Error('Nenhum link válido encontrado nos favoritos.');

        const classified = classifyBookmarks(
          parsed.bookmarks,
          categories,
          subcategories.map(s => ({ name: s.name, category: s.category })),
          links
        );
        const preview: ImportPreviewItem[] = classified.map((item, i) => ({
          ...item,
          temporaryId: createTemporaryId('favorite'),
          description: '',
          createdAt: Date.now() - i,
        }));
        setBookmarkPreview(preview);
        setBookmarkSourceName(file.name);
        setBookmarkReview(true);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Erro ao processar o arquivo.');
      }
    };
    reader.onerror = () => setImportError('Erro ao ler o arquivo.');
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const updateBookmarkPreview = (temporaryId: string, field: 'category' | 'subcategory', value: string) => {
    setBookmarkPreview(prev => prev.map(item => item.temporaryId === temporaryId ? {
      ...item, [field]: value, ...(field === 'category' ? { subcategory: '' } : {}), confidence: 1, reasons: ['ajuste manual pelo usuário']
    } : item));
  };

  const confirmBookmarkImport = async () => {
    try {
      if (!bookmarkPreview.length) return;
      const newLinks: LinkImportPayload[] = bookmarkPreview.map(item => ({
        title: item.title, url: item.url, category: item.category || 'OUTROS',
        subcategory: item.subcategory || '', description: item.description, createdAt: item.createdAt, folderId: null,
      }));
      const newCats = Array.from(new Set(newLinks.map(l => l.category)));
      const newSubs: { name: string; category: string }[] = [];
      for (const link of newLinks) {
        if (link.subcategory && !newSubs.some(s => s.category === link.category && s.name === link.subcategory) &&
            !subcategories.some(s => s.category === link.category && s.name === link.subcategory)) {
          newSubs.push({ name: link.subcategory, category: link.category });
        }
      }
      const res = await fetch(API + '/links/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          links: newLinks,
          categories: newCats.filter(c => !categories.includes(c)),
          subcategories: newSubs,
        }),
      });
      if (!res.ok) throw new Error('Falha ao importar no servidor.');

      const refreshedLinks = await (await fetch(API + '/links')).json();
      const refreshedFolders = await (await fetch(API + '/folders')).json();
      setLinks(refreshedLinks.map(rowToLink));
      setFolders(refreshedFolders);
      setCategories(prev => Array.from(new Set([...prev, ...newCats])));
      setSubcategories(prev => {
        const existing = new Set(prev.map(s => s.category + '::' + s.name));
        const toAdd = newSubs.filter(s => !existing.has(s.category + '::' + s.name));
        return [...prev, ...toAdd.map((s, i) => ({ id: Date.now() + i, ...s }))];
      });
      setBookmarkPreview([]);
      setBookmarkReview(false);
      setBookmarkSourceName('');
      setIsImportModalOpen(false);
      alert(newLinks.length + ' favoritos classificados e importados com sucesso!');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erro ao importar favoritos.');
    }
  };

  const cancelBookmarkReview = () => {
    setBookmarkPreview([]);
    setBookmarkReview(false);
    setBookmarkSourceName('');
  };

  // -------------------------------------------------------------------------
  // Exportar JSON
  // -------------------------------------------------------------------------

  const downloadBlob = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const handleExportJson = () => {
    downloadBlob(JSON.stringify({ links, categories, subcategories, folders }, null, 2), 'application/json;charset=utf-8', 'chart-links-export-' + new Date().toISOString().split('T')[0] + '.json');
  };

  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const handleExportHtml = () => {
    const rows = links.map(link => {
      const tags = (link.folderTags.length ? link.folderTags : (link.folderPath.length ? [link.folderPath.join(' / ')] : [link.category]));
      return `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)}</a><div class="tags">${tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div></li>`;
    }).join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChartLink - Favoritos</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#222}h1{margin-bottom:6px}p{color:#666}ul{padding:0;list-style:none}li{padding:14px 0;border-bottom:1px solid #eee}a{font-weight:700;color:#087f5b;text-decoration:none}.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.tags span{font-size:12px;padding:4px 8px;border-radius:999px;background:#f0fdf4;color:#166534}</style></head><body><h1>ChartLink Manager</h1><p>${links.length} links exportados em ${new Date().toLocaleString('pt-BR')}</p><ul>${rows}</ul></body></html>`;
    downloadBlob(html, 'text/html;charset=utf-8', 'chart-links-export-' + new Date().toISOString().split('T')[0] + '.html');
  };

  const formSubcats = useMemo(() =>
    subcategories.filter(s => s.category === formData.category),
    [subcategories, formData.category]
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm font-medium">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chartlink-app h-screen max-h-screen overflow-hidden bg-zinc-50 text-zinc-900 font-sans flex flex-col">

      {/* HEADER */}
      <header className="chartlink-app-header shrink-0 z-40 bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(p => !p)}
          className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 transition-colors"
          title="Ocultar/mostrar categorias"
          aria-label={sidebarOpen ? 'Ocultar categorias' : 'Mostrar categorias'}
          aria-expanded={sidebarOpen}
          aria-controls="chartlink-sidebar"
        >
          {sidebarOpen ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2 mr-2">
          <div className="bg-emerald-600 p-1.5 rounded-xl shadow-sm shadow-emerald-200">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-bold leading-tight">ChartLink Manager</h1>
            <p className="text-xs text-zinc-400 font-medium leading-tight">Organize seus dashboards e graficos</p>
          </div>
        </div>

        <LinkSearchInput query={searchQuery} regex={regexEnabled} invalid={!!search.error}
          scopeLabel={scopeLabel} onQueryChange={setSearchQuery} onRegexChange={setRegexEnabled} />

        <div className="flex items-center gap-1 ml-auto">
          <ThemeSelector preference={themePreference} resolved={resolvedTheme} onChange={setThemePreference} />
          {auth && <UserMenu session={auth} onLogin={() => setIsLoginOpen(true)} onLogout={() => void logout()}
            onPassword={() => setIsPasswordOpen(true)} onTrash={() => setIsTrashOpen(true)} onUsers={() => setIsUsersOpen(true)} />}
          <button
            onClick={() => openModal()}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200"
          >
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Novo Link</span>
          </button>
          <button onClick={() => { if (!requireAuthenticated()) return; setActiveCatTab(categories[0] || ''); setManagerFolderId(null); setIsCategoryModalOpen(true); }}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all" title="Gerenciar Categorias">
            <Settings className="w-5 h-5" />
          </button>
          <button onClick={handleExportJson}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all" title="Exportar JSON">
            <FileText className="w-5 h-5" />
          </button>
          <button onClick={handleExportHtml}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all" title="Exportar HTML para navegador">
            <ExternalLink className="w-5 h-5" />
          </button>
          <button onClick={() => { if (!requireAuthenticated()) return; setImportMode('csv'); setImportError(null); setIsImportModalOpen(true); }}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all" title="Importar">
            <Upload className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* SIDEBAR */}
        <AnimatedSidebar
          id="chartlink-sidebar"
          open={sidebarOpen}
          width={sidebarWidth}
          resizing={resizingSidebar}
          onResizeStart={() => setResizingSidebar(true)}
          onWidthChange={setSidebarWidth}
        >
              <div className="p-3 flex-1 min-h-0 overflow-y-auto">
                <div className="flex items-center justify-between px-2 mb-3">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Categorias</p>
                    <p className="chartlink-tree-summary mt-0.5">
                      <span><strong>{categoryCount}</strong> {categoryCount === 1 ? 'categoria' : 'categorias'}</span>
                      <span><strong>{subcategoryCount}</strong> {subcategoryCount === 1 ? 'subcategoria' : 'subcategorias'}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">{links.length}</span>
                </div>

                {/* Raiz */}
                <button
                  onClick={() => { setSelectedFolderId(null); handleSelectCategory('Todos'); }}
                  className={
                    'w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 mb-2 ' +
                    (filterCategory === 'Todos'
                      ? 'bg-zinc-900 text-white shadow-md'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800')
                  }
                >
                  <FolderOpen className="w-4 h-4 shrink-0" />
                  <span className="truncate text-left flex-1">Todos os Links</span>
                  <span className={
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full ' +
                    (filterCategory === 'Todos' ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500')
                  }>{links.length}</span>
                </button>

                {/* Árvore de categorias e subcategorias hierárquicas */}
                <div className="mt-2 space-y-0.5">
                  {(() => {
                    const childrenOf = (parentId: number | null) => folders
                      .filter(f => f.parent_id === parentId)
                      .sort((a,b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

                    const countDescendants = (folderId: number) => {
                      const ids = new Set<number>([folderId]);
                      let changed = true;
                      while (changed) {
                        changed = false;
                        folders.forEach(f => {
                          if (f.parent_id !== null && ids.has(f.parent_id) && !ids.has(f.id)) { ids.add(f.id); changed = true; }
                        });
                      }
                      return links.filter(l => l.folderIds.some(fid => ids.has(fid))).length;
                    };

                    const renderFolder = (folder: FolderNode, depth = 0, rootCategoryName?: string): JSX.Element => {
                      const key = `folder:${folder.id}`;
                      const expanded = expandedFolders.has(key);
                      const children = childrenOf(folder.id);
                      const directLinks = sortLinks(links.filter(l => l.folderIds.includes(folder.id)), sortOrder);
                      const active = selectedFolderId === folder.id;
                      // root category for this folder — used to look up the palette color
                      const rootName = depth === 0 ? folder.name : (rootCategoryName || folder.path[0]);
                      const fc = folderColor(depth, rootName, resolveFolderColor(folder.id, folderById), resolvedTheme === 'dark');
                      const isRoot = depth === 0;
                      const isDrop = dropFolderId === folder.id;
                      const count = countDescendants(folder.id);

                      return (
                        <div key={folder.id} className="select-none">
                          {/* ── Folder row ───────────────────────────────── */}
                          <div
                            draggable
                            onDragStart={(e) => handleFolderDragStart(e, folder)}
                            onDragEnd={clearDragState}
                            onDragOver={(e) => { e.preventDefault(); setDropFolderId(folder.id); }}
                            onDragLeave={() => setDropFolderId(null)}
                            onDrop={(e) => void handleFolderDrop(e, folder.id)}
                            className={'chartlink-sidebar-category-row group relative flex items-center gap-0.5 transition-all duration-150 ' + (isRoot ? 'rounded-xl mb-0.5' : 'rounded-lg')}
                            data-active={active}
                            data-drop-target={isDrop}
                            style={{
                              marginLeft: depth * 10,
                              ...getCategoryStyle(rootName, fc.color),
                            }}
                          >
                            {/* Expand/collapse toggle */}
                            <button
                              type="button"
                              onClick={() => toggleFolder(key)}
                              className={'p-1.5 shrink-0 transition-colors ' + (active ? 'text-current' : 'text-zinc-300 hover:text-zinc-600')}
                              style={active ? { color: fc.color } : {}}
                              title={expanded ? 'Recolher' : 'Expandir'}
                            >
                              {children.length > 0 || directLinks.length > 0
                                ? (expanded
                                    ? <ChevronDown className={'transition-transform ' + (isRoot ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
                                    : <ChevronRight className={'transition-transform ' + (isRoot ? 'w-4 h-4' : 'w-3.5 h-3.5')} />)
                                : <span className={'inline-block ' + (isRoot ? 'w-4' : 'w-3.5')} />}
                            </button>

                            {/* Folder label button */}
                            <button
                              type="button"
                              onClick={() => selectFolderNode(folder)}
                              aria-current={active ? 'true' : undefined}
                              className={'group/label flex-1 min-w-0 flex items-center gap-2 py-2 pr-1 text-left'}
                              title={folder.path.join(' / ')}
                            >
                              {/* Folder icon — colored per category */}
                              <CategoryFolderIcon open={expanded} color={fc.color}
                                className={isRoot ? 'w-4 h-4' : 'w-3.5 h-3.5'} />

                              {/* Name */}
                              <span
                                className={'chartlink-folder-label whitespace-normal break-words leading-tight transition-colors ' +
                                  (isRoot ? 'text-sm font-semibold ' : 'text-xs font-medium ') +
                                  (active ? '' : 'text-zinc-700 group-hover/label:text-zinc-900')}
                                style={{ color: '#000000' }}
                              >{folder.name}</span>

                              {/* Count badge */}
                              {count > 0 && (
                                <span
                                  className={'ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 transition-colors ' + (active ? '' : '')}
                                  style={active ? fc.badgeStyle : { color: '#000000', backgroundColor: '#f4f4f5' }}
                                >{count}</span>
                              )}
                            </button>

                            <FolderActionsMenu
                              folderName={folder.name}
                              onColor={auth?.permissions.manageFolders ? () => setColorFolderId(folder.id) : undefined}
                              onAddLink={() => openLinkInFolder(folder.id)}
                              onAddSubcategory={auth?.permissions.manageFolders ? () => openNewFolder(folder.id) : undefined}
                              onDelete={auth?.permissions.manageUsers ? () => requestTreeDelete(folder) : undefined}
                            />
                          </div>

                          {/* ── Expanded children ────────────────────────── */}
                          {expanded && (
                            <div
                              className="ml-4 space-y-0.5"
                              style={{ borderLeft: '2px solid ' + hexToRgba(fc.color, 0.35), paddingLeft: '8px' }}
                            >
                              {/* Direct links inside this folder */}
                              {directLinks.map(link => (
                                <div
                                  key={link.id}
                                  draggable
                                  onDragStart={(e) => handleLinkDragStart(e, link)}
                                  onDragEnd={clearDragState}
                                  className="group/link flex items-center gap-1 rounded-lg hover:bg-sky-50/60 cursor-grab transition-colors"
                                >
                                  <a
                                    href={resolveLinkUrl(link.url) || undefined}
                                    target="_blank" rel="noopener noreferrer" draggable={false}
                                    onClick={() => selectFolderNode(folder)}
                                    className="min-w-0 flex-1 flex items-center gap-2 px-2 py-1.5 text-left"
                                    title={link.url}
                                  >
                                    {/* Colored dot per category */}
                                    <span
                                      className="w-1.5 h-1.5 rounded-full shrink-0"
                                      style={{ backgroundColor: fc.color }}
                                    />
                                    <span className="truncate text-[11px] text-zinc-500 group-hover/link:text-zinc-800 transition-colors leading-snug">{link.title}</span>
                                  </a>
                                  {auth?.permissions.manageLinks && <button type="button" onClick={(e) => { e.stopPropagation(); openCopyForLinks([link.id]); }}
                                    className="p-1.5 text-zinc-300 hover:text-sky-600 rounded-md opacity-0 group-hover/link:opacity-100 transition-all" title="Copiar">
                                    <CopyPlus className="w-3 h-3" />
                                  </button>}
                                  {auth?.permissions.deleteLinks && <button type="button" onClick={(e) => { e.stopPropagation(); setLinkToDelete(link.id); setIsDeleteModalOpen(true); }}
                                    className="p-1.5 mr-1 text-zinc-300 hover:text-red-600 rounded-md opacity-0 group-hover/link:opacity-100 transition-all" title="Excluir">
                                    <Trash2 className="w-3 h-3" />
                                  </button>}
                                </div>
                              ))}
                              {/* Recursive children */}
                              {children.map(child => renderFolder(child, depth + 1, rootName))}
                            </div>
                          )}
                        </div>
                      );
                    };
                    return childrenOf(null).map(folder => renderFolder(folder));
                  })()}
                </div>

                <button type="button" onClick={() => openNewFolder(null)} className="mt-3 w-full flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl border-2 border-dashed border-zinc-200 text-xs font-semibold text-zinc-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/60 transition-all duration-150 group">
                  <FolderPlus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Nova categoria raiz
                </button>

                {links.some(l => l.category === UNCLASSIFIED_CATEGORY) && (
                  <div className="mt-3 pt-3 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => handleSelectCategory(UNCLASSIFIED_CATEGORY)}
                      className={
                        'w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ' +
                        (filterCategory === UNCLASSIFIED_CATEGORY
                          ? 'bg-red-50 text-zinc-900 ring-1 ring-red-200'
                          : 'text-zinc-600 hover:bg-red-50/60 hover:text-zinc-900')
                      }
                    >
                      <CategoryFolderIcon color={UNCLASSIFIED_CATEGORY_COLOR} />
                      <span className="chartlink-folder-label truncate text-left flex-1">{UNCLASSIFIED_CATEGORY}</span>
                      <span className={
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full ' +
                        (filterCategory === UNCLASSIFIED_CATEGORY ? 'bg-red-200 text-black' : 'bg-red-50 text-black')
                      }>{links.filter(l => l.category === UNCLASSIFIED_CATEGORY).length}</span>
                    </button>
                  </div>
                )}

                <div className="mt-4 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-100 flex items-start gap-2">
                  <span className="text-zinc-300 mt-0.5 shrink-0">💡</span>
                  <p className="text-[10px] leading-relaxed text-zinc-400">
                    Clique no nome para filtrar · Seta para expandir · Arraste links entre pastas
                  </p>
                </div>
              </div>
        </AnimatedSidebar>

        {/* MAIN */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-zinc-50">

          {/* BARRA FIXA: somente a área de links abaixo possui rolagem */}
          <div className="shrink-0 z-30 bg-zinc-50 border-b border-zinc-200/80 shadow-sm px-6 pt-2 pb-3">

          {regexEnabled && <p id="chartlink-regex-help" className="text-xs text-zinc-600 mb-3 leading-relaxed">
            Regex: <code>^LI_</code> · <code>Temperatura|Vácuo</code> · <code>/^SI_.*Temp/i</code>. Pesquisa títulos, URLs, descrições e pastas dentro da seleção atual. Para buscar em toda a aplicação, selecione Todos os Links.
          </p>}
          {search.pending && <p role="status" className="text-xs text-violet-700 mb-3">Pesquisando expressão…</p>}
          {search.error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3 mb-3">{search.error}</p>}
          {/* Subcategory pills */}
          {filterCategory !== 'Todos' && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {(() => {
                // pills inherit the active category's palette color
                const activeFolder = selectedFolderId !== null ? folderById.get(selectedFolderId)
                  : folders.find(folder => folder.parent_id === null && folder.name === filterCategory);
                const activeCatColor = activeFolder ? resolveFolderColor(activeFolder.id, folderById) : categoryColor(filterCategory);
                const darkTheme = resolvedTheme === 'dark';
                const fc = folderColor(0, activeFolder?.path[0] || filterCategory, activeCatColor, darkTheme);
                const isColored = activeCatColor !== '#000000';
                return (
                  <>
                    <Tag className="w-3.5 h-3.5 shrink-0" style={{ color: isColored ? activeCatColor : '#a1a1aa' }} />
                    {/* "Todas" pill */}
                    <button
                      onClick={() => handleSelectSubcategory('Todas')}
                      className="chartlink-subcat-pill px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150"
                      style={
                        activeSubcategory === 'Todas'
                          ? fc.pillActiveStyle
                          : {
                              backgroundColor: darkTheme ? '#24282d' : '#fff',
                              border: '1.5px solid ' + (darkTheme ? '#4b525a' : '#e4e4e7'),
                              color: darkTheme ? '#f4f4f5' : '#52525b',
                            }
                      }
                    >Todas</button>

                    {/* Per-subcategory pills */}
                    {visibleSubcats.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => handleSelectSubcategory(sub.name)}
                        className="chartlink-subcat-pill px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150"
                        style={
                          activeSubcategory === sub.name
                            ? fc.pillActiveStyle
                            : {
                                backgroundColor: darkTheme
                                  ? (isColored ? hexToRgba(activeCatColor, 0.2) : '#24282d')
                                  : (isColored ? hexToRgba(activeCatColor, 0.07) : '#fff'),
                                border: '1.5px solid ' + (isColored
                                  ? hexToRgba(activeCatColor, darkTheme ? 0.7 : 0.4)
                                  : (darkTheme ? '#4b525a' : '#e4e4e7')),
                                color: darkTheme ? '#f4f4f5' : '#000000',
                              }
                        }
                      >{sub.name}</button>
                    ))}

                    {visibleSubcats.length === 0 && filterCategory !== UNCLASSIFIED_CATEGORY && (
                      <span className="text-xs text-zinc-400 italic ml-1">
                        Nenhuma subcategoria — adicione pelo ícone de configurações
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Controles */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <p id="chartlink-search-scope" className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              {searchQuery.trim() ? <span className="text-violet-600 normal-case">Busca em: {scopeLabel}</span> : scopeLabel}
              {' · '}
              <span className="text-emerald-600">
                {filteredLinks.length} resultado{filteredLinks.length !== 1 ? 's' : ''}
              </span>
            </p>
            <div className="flex items-center gap-2 ml-auto">
              {auth?.permissions.manageLinks && <button onClick={toggleSelectVisible} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
                {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                {allVisibleSelected ? 'Desmarcar' : 'Selecionar'}
              </button>}
              <select value={sortOrder} onChange={event => {const value = event.target.value; if (value === 'recent' || value === 'recent-edited' || value === 'az' || value === 'za' || value === 'category-az' || value === 'category-za' || value === 'primary-tag') 
setSortOrder(value); }} aria-label="Ordenar links" className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-600 outline-none" title="Ordenar links">
		<option value="recent">Recentes (Data da criação)</option>
		<option value="recent-edited">Recentes (Data de edição)</option>
		<option value="az">Título: A → Z</option>
		<option value="za">Título: Z → A</option>
		<option value="category-az">Categorias: A → Z</option>
		<option value="category-za">Categorias: Z → A</option>
		<option value="primary-tag">Agrupar por tags primárias</option>            
              </select>
              <div className="flex items-center bg-white border border-zinc-200 rounded-xl p-1">
              <button onClick={() => setViewMode('grid')} aria-label="Exibir em grade" aria-pressed={viewMode === 'grid'}
                className={'p-1.5 rounded-lg transition-all ' + (viewMode === 'grid' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600')}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} aria-label="Exibir em lista" aria-pressed={viewMode === 'list'}
                className={'p-1.5 rounded-lg transition-all ' + (viewMode === 'list' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600')}>
                <List className="w-4 h-4" />
              </button>
              </div>
            </div>
          </div>


          {selectedCount > 0 && (
            <div className="mb-1 flex items-center gap-2 flex-wrap p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <span className="text-sm font-bold text-emerald-800 mr-2">{selectedCount} selecionado{selectedCount === 1 ? '' : 's'}</span>
              <button onClick={() => { const initialFolder = selectedFolderId ?? folders.find(f => f.parent_id === null)?.id ?? null; const initial = folders.find(f => f.id === initialFolder); setBulkMoveMode('move'); setBulkMoveFolderId(initialFolder); setBulkMoveCategory(initial?.path[0] || filterCategory || categories[0] || ''); setBulkMoveSubcategory(initial?.path[initial.path.length - 1] || ''); setIsBulkMoveOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100">
                <ArrowRightLeft className="w-4 h-4" /> Mover
              </button>
              <button onClick={() => { const initialFolder = selectedFolderId ?? folders.find(f => f.parent_id === null)?.id ?? null; const initial = folders.find(f => f.id === initialFolder); setBulkMoveMode('copy'); setBulkMoveFolderId(initialFolder); setBulkMoveCategory(initial?.path[0] || filterCategory || categories[0] || ''); setBulkMoveSubcategory(initial?.path[initial.path.length - 1] || ''); setIsBulkMoveOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-sky-200 text-sky-700 rounded-xl text-xs font-semibold hover:bg-sky-100">
                <CopyPlus className="w-4 h-4" /> Copiar
              </button>
              <button onClick={() => void bulkDelete()} className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-600">
                <Trash2 className="w-4 h-4" /> Enviar para lixeira
              </button>
              <button onClick={clearSelection} className="px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800">Limpar seleção</button>
            </div>
          )}

          </div>

          {/* ÁREA ROLÁVEL: apenas os links rolam; a barra acima permanece sempre visível */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-6">

          <LinkCollection
            links={filteredLinks}
            folders={folderById}
            selectedFolderId={selectedFolderId}
            viewMode={viewMode}
            sortOrder={sortOrder}
            selectedLinkIds={selectedLinkIds}
            copiedId={copiedId}
            draggingLinkId={draggingLinkId}
            canManage={!!auth?.permissions.manageLinks}
            onToggleSelection={toggleLinkSelection}
            onShare={handleShare}
            onInfo={link => setInfoLinkId(link.id)}
            onCopy={id => openCopyForLinks([id])}
            onEdit={openModal}
            onDelete={id => { if (!requireAuthenticated()) return; setLinkToDelete(id); setIsDeleteModalOpen(true); }}
            onDragStart={handleLinkDragStart}
            onDragEnd={clearDragState}
          />

          {/* Empty state */}
          {filteredLinks.length === 0 && !search.pending && !search.error && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center mb-4">
                <LinkIcon className="w-9 h-9 text-zinc-300" />
              </div>
              <h3 className="text-lg font-bold text-zinc-400">
                {searchQuery || filterCategory !== 'Todos' || filterSubcategory !== 'Todas'
                  ? 'Nenhum resultado encontrado' : 'Nenhum link cadastrado ainda'}
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                {searchQuery || filterCategory !== 'Todos' || filterSubcategory !== 'Todas'
                  ? 'Tente outros filtros.' : 'Clique em "+ Novo Link" para comecar.'}
              </p>
            </div>
          )}

          </div>
        </main>
      </div>

      {colorFolder && <FolderColorDialog key={colorFolder.id} folder={colorFolder}
        inheritedColor={colorFolder.parent_id === null ? categoryColor(colorFolder.path[0] || colorFolder.name) : resolveFolderColor(colorFolder.parent_id, folderById)}
        onSave={saveFolderColor} onClose={() => setColorFolderId(null)} />}
      {infoLink && <LinkInfoDialog link={infoLink} folders={folderById} onClose={() => setInfoLinkId(null)} />}

      {/* ================================================================ */}
      {/* MODAL: Adicionar / Editar Link                                    */}
      {/* ================================================================ */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900">{editingLink ? 'Editar Link' : 'Novo Link'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-zinc-100 rounded-full transition-colors"><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <form onSubmit={handleAddOrEdit}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Titulo *</label>
                    <input autoFocus type="text" required placeholder="Ex.: SI_Efficiency"
                      className="mt-1.5 w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">URL *</label>
                    <input type="url" required placeholder="https://..."
                      className="mt-1.5 w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      value={formData.url} onChange={e => setFormData(p => ({ ...p, url: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Categoria / Subcategoria de destino</label>
                    <select className="mt-1.5 w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      value={formData.folderId ?? UNCLASSIFIED_CATEGORY}
                      disabled={!canAssignLinkCategory}
                      onChange={e => {
                        if (e.target.value === UNCLASSIFIED_CATEGORY) {
                          setFormData(p => ({ ...p, folderId: null, category: UNCLASSIFIED_CATEGORY, subcategory: '' }));
                          return;
                        }
                        const id = Number(e.target.value);
                        const f = folders.find(x => x.id === id);
                        setFormData(p => ({ ...p, folderId: id, category: f?.path[0] || p.category, subcategory: f?.path[1] || '' }));
                      }}>
                      <option value={UNCLASSIFIED_CATEGORY}>{UNCLASSIFIED_CATEGORY}</option>
                      {canAssignLinkCategory && [...folders].sort((a,b) => a.path.join(' / ').localeCompare(b.path.join(' / '), 'pt-BR', { sensitivity: 'base' })).map(f => <option key={f.id} value={f.id}>{'  '.repeat(f.level)}{f.path.join(' / ')}</option>)}
                    </select>
                    <p className="mt-1 text-[10px] text-zinc-400">A URL será exibida diretamente abaixo da categoria/subcategoria na árvore lateral.</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Descricao</label>
                    <textarea placeholder="Descreva brevemente este grafico..." rows={3}
                      className="mt-1.5 w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                      value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  {linkFormError && (
                    <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{linkFormError}</p>
                    </div>
                  )}
                </div>
                <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3">
                  <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={linkSaving} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:cursor-wait disabled:opacity-60">{linkSaving ? 'Salvando...' : editingLink ? 'Salvar' : 'Adicionar'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================ */}
      {/* MODAL: Excluir                                                    */}
      {/* ================================================================ */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto"><Trash2 className="w-7 h-7" /></div>
                <h2 className="text-xl font-bold text-zinc-900">Enviar para a lixeira?</h2>
                <p className="text-sm text-zinc-500">O link poderá ser restaurado posteriormente.</p><p className="text-xs text-zinc-400 mt-2"><kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded">Enter</kbd> confirmar · <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded">Esc</kbd> cancelar</p>
              </div>
              <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-50 transition-colors">Cancelar</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors">Mover para lixeira</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTreeDeleteModalOpen && treeDeleteTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsTreeDeleteModalOpen(false); setTreeDeleteTarget(null); }} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto"><Trash2 className="w-7 h-7" /></div>
                <h2 className="text-xl font-bold text-zinc-900">Excluir categoria/subcategoria?</h2>
                <p className="text-sm text-zinc-500">A estrutura <strong>{treeDeleteTarget.path.join(' / ')}</strong> e suas subcategorias serão removidas.</p>
                <p className="text-xs text-zinc-400">Os links afetados irão para <strong>{UNCLASSIFIED_CATEGORY}</strong>. Esta ação não pode ser desfeita.</p>
              </div>
              <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3">
                <button onClick={() => { setIsTreeDeleteModalOpen(false); setTreeDeleteTarget(null); }} className="flex-1 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 font-semibold rounded-xl">Cancelar</button>
                <button onClick={() => void confirmTreeDelete()} className="flex-1 px-4 py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600">Excluir</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkMoveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBulkMoveOpen(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <div><h2 className="text-xl font-bold text-zinc-900">{bulkMoveMode === 'move' ? 'Mover' : 'Copiar'} links selecionados</h2><p className="text-sm text-zinc-500 mt-1">{selectedCount} link{selectedCount === 1 ? '' : 's'} serão enviados para o destino escolhido.</p></div>
                <button onClick={() => setIsBulkMoveOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Destino</p>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 min-h-11">
                    {bulkMoveFolder ? bulkMoveFolder.path.join(' / ') : 'Selecione uma categoria/subcategoria'}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 p-2 space-y-1">
                  {(() => {
                    const childrenOf = (parentId: number | null) => folders.filter(f => f.parent_id === parentId).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
                    const renderMoveNode = (folder: FolderNode, depth = 0): JSX.Element => {
                      const children = childrenOf(folder.id);
                      const selected = bulkMoveFolderId === folder.id;
                      const key = 'bulk:' + folder.id;
                      const expanded = expandedFolders.has(key);
                      return <div key={folder.id}>
                        <div className={'flex items-center gap-1 rounded-lg ' + (selected ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-zinc-50')} style={{ marginLeft: depth * 12 }}>
                          <button type="button" onClick={() => toggleFolder(key)} className="p-1 text-zinc-400 shrink-0">{children.length ? (expanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>) : <span className="w-3 inline-block"/>}</button>
                          <button type="button" onClick={() => { setBulkMoveFolderId(folder.id); setBulkMoveCategory(folder.path[0] || ''); setBulkMoveSubcategory(folder.name); }} className="flex-1 flex items-center gap-2 text-left px-2 py-2 text-xs font-medium min-w-0">
                            <CategoryFolderIcon open={expanded} color={resolveFolderColor(folder.id, folderById)} className="w-3.5 h-3.5"/><span className="chartlink-folder-label truncate">{folder.name}</span>
                          </button>
                        </div>
                        {expanded && children.map(child => renderMoveNode(child, depth + 1))}
                      </div>;
                    };
                    return folders.filter(f => f.parent_id === null).map(f => renderMoveNode(f));
                  })()}
                </div>
                <p className="text-[10px] text-zinc-400">É possível mover um ou vários links para qualquer nível existente da árvore.</p>
              </div>
              <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3">
                <button onClick={() => setIsBulkMoveOpen(false)} className="flex-1 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 font-semibold rounded-xl">Cancelar</button>
                <button onClick={() => void bulkMove()} disabled={bulkMoveFolderId === null} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50">{bulkMoveMode === 'move' ? 'Mover links' : 'Copiar links'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================ */}
      {/* MODAL: Nova categoria / subcategoria                                      */}
      {/* ================================================================ */}
      <AnimatePresence>
        {isFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFolderModalOpen(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <div><h2 className="text-lg font-bold text-zinc-900">Nova {folderParentId === null ? 'categoria' : `subcategoria ${((folders.find(f => f.id === folderParentId)?.level ?? 0) + 1)}`}</h2><p className="text-xs text-zinc-400 mt-1">{folderParentId === null ? 'Será criada na raiz.' : (folders.find(f => f.id === folderParentId)?.level === 0 ? 'Será criada diretamente dentro da categoria selecionada.' : 'Será criada diretamente dentro da subcategoria selecionada.')}</p></div>
                <button type="button" onClick={() => setIsFolderModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <form onSubmit={createFolder}>
                <div className="p-6">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nome da {folderParentId === null ? 'categoria' : 'subcategoria'} *</label>
                  <input autoFocus required value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Ex.: Câmaras de Vácuo" className="mt-1.5 w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3">
                  <button type="button" onClick={() => setIsFolderModalOpen(false)} className="flex-1 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 font-semibold rounded-xl">Cancelar</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700">Criar {folderParentId === null ? 'categoria' : 'subcategoria'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================ */}
      {/* MODAL: Gerenciar Categorias + Subcategorias                       */}
      {/* ================================================================ */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-screen" style={{ maxHeight: '90vh' }}>
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold text-zinc-900">Categorias e Subcategorias</h2>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors"><X className="w-5 h-5 text-zinc-400" /></button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Painel esquerdo: categorias */}
                <div className="w-44 border-r border-zinc-100 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-zinc-100">
                    <form onSubmit={addCategory} className="flex gap-1">
                      <input type="text" placeholder="Nova categ..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                      <button type="submit" title="Enviar / criar categoria" className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shrink-0"><Send className="w-3.5 h-3.5" /></button>
                    </form>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
		    {rootCategoryNames.map(cat => (                    
                      <div key={cat} className={'group rounded-xl transition-all ' + (activeCatTab === cat ? 'bg-emerald-50' : 'hover:bg-zinc-50')}>
                        {editingCategory && editingCategory.oldName === cat ? (
                          <div className="flex items-center gap-1 p-1.5">
                            <input autoFocus type="text" className="flex-1 min-w-0 px-2 py-1 bg-white border border-emerald-500 rounded-lg text-xs"
                              value={editingCategory.newName}
                              onChange={e => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                              onKeyDown={e => e.key === 'Enter' && saveCategoryEdit()} />
                            <button onClick={saveCategoryEdit} className="p-1 text-emerald-600 shrink-0"><Check className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setActiveCatTab(cat); setManagerFolderId(null); }} className="w-full flex items-center justify-between p-2 text-xs font-medium text-left">
                            <span className={'chartlink-folder-label truncate ' + (activeCatTab === cat ? 'font-bold' : '')}>{cat}</span>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 shrink-0">
                              <button onClick={e => { e.stopPropagation(); setEditingCategory({ oldName: cat, newName: cat }); }} className="p-0.5 text-zinc-400 hover:text-emerald-600"><Edit2 className="w-3 h-3" /></button>
                              {auth?.permissions.manageUsers && <button onClick={e => { e.stopPropagation(); deleteCategory(cat); }} className="p-0.5 text-zinc-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
                            </div>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Painel direito: subcategorias */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-zinc-100">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Subcategorias de <span className="chartlink-folder-label">{activeCatTab || '--'}</span>
                    </p>
                    <div className="text-[10px] text-zinc-400 mb-2 truncate"
                      title={managerFolderId ? (folders.find(f => f.id === managerFolderId)?.path.join(' / ') || '') : ''}>
                      {managerFolderId
                        ? `Destino: ${folders.find(f => f.id === managerFolderId)?.path.join(' / ') || '--'}`
                        : 'Selecione uma categoria/subcategoria'}
                    </div>
                    <form onSubmit={createManagerSubfolder} className="flex gap-1">
                      <input type="text" placeholder="Nova subcategoria..." value={newSubcatName} onChange={e => setNewSubcatName(e.target.value)}
                        disabled={!managerFolderId}
                        className="flex-1 px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50" />
                      <button type="submit" disabled={!managerFolderId} title="Enviar / criar subcategoria dentro da categoria selecionada"
                        className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 shrink-0">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {!managerRoot && (
                      <p className="text-xs text-zinc-400 italic text-center mt-4">Selecione uma categoria.</p>
                    )}
                    {managerRoot && managerChildren(managerRoot.id).length === 0 && (
                      <p className="text-xs text-zinc-400 italic text-center mt-4">Nenhuma subcategoria ainda.</p>
                    )}
                    {managerRoot && managerChildren(managerRoot.id).map(folder => renderManagerFolder(folder))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 border-t border-zinc-100 shrink-0">
                <button onClick={() => setIsCategoryModalOpen(false)} className="w-full px-4 py-2.5 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors">Fechar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================ */}
      {/* MODAL: Importar (CSV / Firefox)                                   */}
      {/* ================================================================ */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setIsImportModalOpen(false); setImportError(null); cancelBookmarkReview(); }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900">Importar links</h2>
                <button onClick={() => { setIsImportModalOpen(false); setImportError(null); cancelBookmarkReview(); }} className="p-2 hover:bg-zinc-100 rounded-full">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Abas */}
              <div className="flex border-b border-zinc-100">
                <button
                  onClick={() => { setImportMode('csv'); setImportError(null); }}
                  className={'flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ' +
                    (importMode === 'csv' ? 'text-emerald-600 border-emerald-600' : 'text-zinc-400 border-transparent hover:text-zinc-600')}
                >
                  CSV
                </button>
                <button
                  onClick={() => { setImportMode('firefox'); setImportError(null); }}
                  className={'flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ' +
                    (importMode === 'firefox' ? 'text-emerald-600 border-emerald-600' : 'text-zinc-400 border-transparent hover:text-zinc-600')}
                >
                  Favoritos Firefox
                </button>
              </div>

              <div className="p-6 space-y-5">
                {importError && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" /><p>{importError}</p>
                  </div>
                )}

                {importMode === 'csv' && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <FileText className="w-7 h-7" />
                      </div>
                      <p className="text-xs text-zinc-500">
                        Colunas: <span className="font-mono font-bold">Titulo, URL, Categoria, Subcategoria, Descricao</span>
                      </p>
                    </div>
                    <label className="block">
                      <input type="file" accept=".csv" onChange={handleCsvImport}
                        className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer" />
                    </label>
                    <div className="bg-zinc-50 p-3 rounded-2xl">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Exemplo:</p>
                      <code className="text-xs text-zinc-600 block bg-white p-2 border border-zinc-200 rounded-lg overflow-x-auto whitespace-nowrap">
                        Titulo, URL, Categoria, Subcategoria<br />
                         </code>
                    </div>
                  </div>
                )}

                {importMode === 'firefox' && !bookmarkReview && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center">
                        <span className="text-3xl" role="img" aria-label="Firefox">&#x1F98A;</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">Importação de favoritos</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          O ChartLink analisa título, URL, categoria/subcategoria de origem</p>
                      </div>
                    </div>
                    <label className="block">
                      <input type="file" accept=".html,.htm" onChange={prepareBookmarkImport}
                        className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer" />
                    </label>
                    <div className="bg-zinc-50 p-3 rounded-2xl space-y-1 text-xs text-zinc-500">
                      <p><strong>1.</strong> Extrai favoritos do HTML/Firefox.</p>
                      <p><strong>2.</strong> Compara com a lista existente do ChartLink.</p>
                      <p><strong>3.</strong> Aplica regras para LINAC, ANEL, RF, BOOSTER, LTB, BTS, etc.</p>
                      <p><strong>4.</strong> Mostra uma prévia para revisão antes de salvar.</p>
                    </div>
                  </div>
                )}

                {importMode === 'firefox' && bookmarkReview && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-zinc-800">Revisar classificação</p>
                        <p className="text-xs text-zinc-500">{bookmarkSourceName} · {bookmarkPreview.length} favoritos</p>
                      </div>
                      <button onClick={cancelBookmarkReview} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">Trocar arquivo</button>
                    </div>
                    <div className="flex gap-2 flex-wrap text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{bookmarkPreview.filter(x => x.confidence >= 0.85).length} alta confiança</span>
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">{bookmarkPreview.filter(x => x.confidence >= 0.58 && x.confidence < 0.85).length} revisar</span>
                      <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 font-semibold">{bookmarkPreview.filter(x => x.confidence < 0.58).length} baixa</span>
                    </div>
                    <div className="max-h-[48vh] overflow-y-auto border border-zinc-100 rounded-2xl divide-y divide-zinc-100">
                      {bookmarkPreview.map(item => (
                        <div key={item.temporaryId} className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-800 truncate">{item.title}</p>
                              <p className="text-[10px] text-zinc-400 font-mono truncate">{item.url}</p>
                              {(item.originalCategory || item.originalSubcategory) && <p className="text-[10px] text-zinc-400 mt-1">Origem: {item.originalCategory}{item.originalSubcategory ? ' / ' + item.originalSubcategory : ''}</p>}
                            </div>
                            <span className={'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ' + (item.confidence >= 0.85 ? 'bg-emerald-50 text-emerald-700' : item.confidence >= 0.58 ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-500')}>{Math.round(item.confidence * 100)}%</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select value={item.category} onChange={e => updateBookmarkPreview(item.temporaryId, 'category', e.target.value)} className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs">
                              {Array.from(new Set([...categories, 'OUTROS', 'Geral'])).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <select value={item.subcategory} onChange={e => updateBookmarkPreview(item.temporaryId, 'subcategory', e.target.value)} className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs">
                              <option value="">-- sem subcategoria --</option>
                              {subcategories.filter(s => s.category === item.category).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                          </div>
                          {item.reasons.length > 0 && <p className="text-[10px] text-zinc-400">{item.reasons[0]}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 bg-zinc-50 border-t border-zinc-100 flex gap-3">
                {importMode === 'firefox' && bookmarkReview ? (
                  <>
                    <button onClick={cancelBookmarkReview} className="flex-1 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-50 transition-colors">Cancelar</button>
                    <button onClick={confirmBookmarkImport} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors">Importar classificados</button>
                  </>
                ) : (
                  <button onClick={() => { setIsImportModalOpen(false); setImportError(null); cancelBookmarkReview(); }}
                    className="w-full px-4 py-2.5 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors">Fechar</button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isLoginOpen && <AuthDialog mode="login" onClose={() => setIsLoginOpen(false)} onSession={acceptAuthSession} />}
      {isPasswordOpen && auth?.authenticated && <AuthDialog mode="change-password"
        onClose={() => setIsPasswordOpen(false)}
        onSession={next => { acceptAuthSession(next); if (!next.user?.mustChangePassword) setIsPasswordOpen(false); }} />}
      {isTrashOpen && auth?.authenticated && <TrashDialog session={auth} onClose={() => setIsTrashOpen(false)}
        onChanged={() => void refreshLinksAndFolders()} />}
      {isUsersOpen && auth?.permissions.manageUsers && auth.user && <AdminUsersDialog currentUserId={auth.user.id} onClose={() => setIsUsersOpen(false)} />}

    </div>
  );
}

export default App;
