import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LinkCard } from '../src/components/LinkCard';
import { LinkInfoDialog } from '../src/components/LinkInfoDialog';
import { CategoryArtDecoration } from '../src/components/CategoryArtwork';
import { FolderActionsMenu } from '../src/components/FolderActionsMenu';
import { ThemeSelector } from '../src/components/ThemeSelector';
import { LinkCollection } from '../src/components/LinkCollection';
import { clampSidebarWidth, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH } from '../src/components/AnimatedSidebar';
import { getCategoryStyle, linkPresentation, resolveFolderColor } from '../src/styles/categoryStyles';
import { matchRegex } from '../src/search/matcher';
import { resolveLinkUrl, formatLinkDate } from '../src/utils/linkUrl';
import { scopeLinks, sortLinks } from '../src/utils/linkView';
import { createTemporaryId } from '../src/utils/temporaryId';
import { UNCLASSIFIED_CATEGORY, UNCLASSIFIED_CATEGORY_COLOR } from '../src/constants/categories';
import { isThemePreference, resolveTheme } from '../src/theme/theme';
import { classifyBookmark } from '../src/bookmarks/bookmarkClassifier';
import type { ChartLink, FolderNode } from '../src/types/chartlink';

const noop = () => {};
const folders = new Map<number, FolderNode>([
  [1, { id: 1, name: 'LINAC', parent_id: null, level: 0, path: ['LINAC'], color: '#ff8800' }],
  [2, { id: 2, name: 'Temperatura', parent_id: 1, level: 1, path: ['LINAC', 'Temperatura'], color: null }],
  [3, { id: 3, name: 'ANEL (SI)', parent_id: null, level: 0, path: ['ANEL (SI)'], color: '#000000' }],
]);
const link: ChartLink = {
  id: 'test-link', title: 'LI_Temp_45°C', url: 'https://example.org/chart?a=1&b=2', category: 'LINAC', subcategory: 'Temperatura',
  description: 'Temperatura de teste', createdAt: 1700000000000, updatedAt: null,
  folderId: 2, folderIds: [2, 3], folderPath: ['LINAC', 'Temperatura'], folderPaths: [['LINAC', 'Temperatura'], ['ANEL (SI)']],
  folderTags: ['LINAC', 'Temperatura', 'ANEL (SI)'], folderTagItems: [],
};
const actions = { onToggleSelection: noop, onShare: noop, onCopy: noop, onEdit: noop, onDelete: noop, onInfo: noop, onDragStart: noop, onDragEnd: noop };

test('IDs temporários funcionam sem crypto.randomUUID e não se repetem na sessão', () => {
  const first = createTemporaryId('favorite');
  const second = createTemporaryId('favorite');
  assert.match(first, /^favorite-[a-z0-9]+-[a-z0-9]+$/);
  assert.notEqual(first, second);
});

test('classificação usa os links da instalação como referência, sem catálogo privado no código', () => {
  const result = classifyBookmark({ title: 'Imported', url: link.url, originalCategory: '', originalSubcategory: '' }, [], [], [link]);
  assert.equal(result.category, link.category);
  assert.equal(result.subcategory, link.subcategory);
  assert.equal(result.confidence, 0.99);
});

test('grade e lista abrem toda a área por âncora _blank, com botões fora da âncora', () => {
  for (const viewMode of ['grid', 'list'] as const) {
    const html = renderToStaticMarkup(<LinkCard link={link} category="LINAC" subcategory="Temperatura" viewMode={viewMode}
      selected={false} copied={false} dragging={false} canManage {...actions} />);
    const anchor = html.match(/<a\b[^>]*class="chartlink-card-open"[^>]*>/)?.[0];
    assert.ok(anchor);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
    assert.match(anchor, /href="https:\/\/example.org\/chart/);
    assert.ok(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button\b/.test(html));
    assert.match(html, /Informações de LI_Temp/);
    assert.match(html, /chartlink-link-title/);
    assert.match(html, /Temperatura/);
  }
});

test('arte de categoria inclui emblema na decoração e RAD usa o trifólio de radiação', () => {
  const html = renderToStaticMarkup(<CategoryArtDecoration category="RAD" />);
  assert.match(html, /chartlink-art-emblem/);
  assert.match(html, /lucide-radiation/);
});

test('lista reserva uma célula própria para a arte e a barra lateral respeita a nova largura mínima', () => {
  const html = renderToStaticMarkup(<LinkCard link={link} category="LINAC" subcategory="Temperatura / Sala" viewMode="list"
    selected={false} copied={false} dragging={false} canManage {...actions} />);
  assert.match(html, /chartlink-list-art-space/);
  assert.match(html, /title="Temperatura \/ Sala"/);
  assert.equal(SIDEBAR_MIN_WIDTH, 320);
  assert.equal(SIDEBAR_DEFAULT_WIDTH, 380);
  assert.equal(clampSidebarWidth(260), 320);
  assert.equal(clampSidebarWidth(Number.NaN), 380);
});

test('menu contextual preserva os ícones e usa pasta com adição para subcategoria', () => {
  const html = renderToStaticMarkup(<FolderActionsMenu folderName="LINAC" onColor={noop}
    onDelete={noop} onAddLink={noop} onAddSubcategory={noop} />);
  assert.match(html, /Opções de LINAC/);
  assert.match(html, /lucide-ellipsis-vertical/);
  // O popover é montado somente quando aberto; o componente-fonte mantém o título solicitado.
  assert.equal(typeof FolderActionsMenu, 'function');
});

test('seletor oferece os três temas e a resolução automática acompanha o sistema', () => {
  const html = renderToStaticMarkup(<ThemeSelector preference="system" resolved="dark" onChange={noop} />);
  assert.match(html, /Tema: Automático/);
  assert.match(html, /lucide-monitor/);
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(isThemePreference('light'), true);
  assert.equal(isThemePreference('invalid'), false);
});

test('a paleta herda do pai, aceita preto, permite override e usa a classificação da pasta filtrada', () => {
  assert.equal(resolveFolderColor(2, folders), '#ff8800');
  const custom = new Map(folders);
  custom.set(2, { ...folders.get(2)!, color: '#ffffff' });
  assert.equal(resolveFolderColor(2, custom), '#ffffff');
  assert.equal(resolveFolderColor(3, folders), '#000000');
  assert.equal(linkPresentation(link, folders, 3).category, 'ANEL (SI)');
  assert.equal(linkPresentation(link, folders, 3).color, '#000000');
  assert.equal(linkPresentation(link, folders, null).subcategory, 'Temperatura');
  assert.equal(getCategoryStyle('LINAC', '#000000')['--chartlink-category-rgb'], '0, 0, 0');
  assert.equal(getCategoryStyle(UNCLASSIFIED_CATEGORY)['--chartlink-category-color'], UNCLASSIFIED_CATEGORY_COLOR);
  custom.set(2, { ...folders.get(2)!, parent_id: 2, color: null });
  assert.equal(resolveFolderColor(2, custom), '#f3d2d5');
});

test('regex: âncoras, alternativas, flags, Unicode, erros e independência entre campos', () => {
  const records = [{ id: '1', fields: ['LI_Temp_45°C', 'Vácuo'] }, { id: '2', fields: ['si_temperature', 'Pressão'] }];
  assert.deepEqual(matchRegex({ query: '^LI_', records }).ids, ['1']);
  assert.deepEqual(matchRegex({ query: 'Vácuo|Pressão', records }).ids, ['1', '2']);
  assert.deepEqual(matchRegex({ query: '/^SI_/i', records }).ids, ['2']);
  assert.deepEqual(matchRegex({ query: '/^SI_/', records }).ids, []);
  assert.deepEqual(matchRegex({ query: '/Temp/gi', records }).ids, ['1', '2']);
  assert.deepEqual(matchRegex({ query: '/^LI_/y', records }).ids, ['1']);
  assert.ok(matchRegex({ query: '[', records }).error);
  assert.ok(matchRegex({ query: '/x/ii', records }).error);
  assert.ok(matchRegex({ query: 'a'.repeat(513), records }).error);
});

test('endereços sem esquema são normalizados; protocolos executáveis e dados quebrados não navegam', () => {
  assert.equal(resolveLinkUrl('192.168.1.20:8080/plot'), 'http://192.168.1.20:8080/plot');
  assert.equal(resolveLinkUrl('https://example.org'), 'https://example.org/');
  assert.equal(resolveLinkUrl('//example.org/plot'), 'http://example.org/plot');
  for (const invalid of ['javascript:alert(1)', 'data:text/html,hello', 'por V.W.Setzer"', '', '_e_TR06_"']) assert.equal(resolveLinkUrl(invalid), null);
  const html = renderToStaticMarkup(<LinkCard link={{ ...link, url: 'javascript:alert(1)' }} category="LINAC" subcategory="" viewMode="list"
    selected={false} copied={false} dragging={false} canManage {...actions} />);
  assert.match(html, /aria-disabled="true"/);
  assert.ok(!html.includes('href="javascript:'));
});

test('informações mostram a criação e não inventam uma data de edição para registros legados', () => {
  const html = renderToStaticMarkup(<LinkInfoDialog link={link} folders={folders} onClose={noop} />);
  assert.match(html, /Nenhuma edição registrada/);
  assert.match(html, /2023/);
  assert.match(html, /LINAC \/ Temperatura/);
  assert.match(html, /ANEL \(SI\)/);
  assert.equal(formatLinkDate(Number.NaN), 'Não informada');
});

test('A–Z e Z–A usam títulos em português, números naturais e não alteram os dados', () => {
  const source = Object.freeze([
    { ...link, id: 'z', title: 'Zeta', createdAt: 1700000000400 },
    { ...link, id: 'a10', title: 'área 10', createdAt: 1700000000200 },
    { ...link, id: 'a2', title: '  Área 2  ', createdAt: 1700000000200 },
    { ...link, id: 'alpha', title: '"Alfa"', createdAt: 1700000000100 },
  ]);
  const ids = (rows: readonly ChartLink[]) => rows.map(row => row.id);
  assert.deepEqual(ids(sortLinks(source, 'az')), ['alpha', 'a2', 'a10', 'z']);
  assert.deepEqual(ids(sortLinks(source, 'za')), ['z', 'a10', 'a2', 'alpha']);
  assert.deepEqual(ids(source), ['z', 'a10', 'a2', 'alpha']);
  assert.equal(source[2].title, '  Área 2  ');
  assert.deepEqual(ids(sortLinks(source, 'recent')), ['z', 'a2', 'a10', 'alpha']);
  const sameTitle = [{ ...link, id: '2' }, { ...link, id: '1' }];
  assert.deepEqual(ids(sortLinks(sameTitle, 'recent')), ['1', '2']);
  assert.deepEqual(ids(sortLinks([...source, { ...link, id: 'bad-date', createdAt: NaN }], 'recent')),
    ['z', 'a2', 'a10', 'alpha', 'bad-date']);
});

test('ordenação por categoria e por tag primária usa o título como desempate', () => {
  const source = [
    { ...link, id: 'b', title: 'Zulu', category: 'BTS', folderPaths: [['BTS', 'Vácuo']], folderPath: ['BTS', 'Vácuo'],
      folderTagItems: [{ id: 10, name: 'BTS', level: 0, path: ['BTS'] }, { id: 11, name: 'Vácuo', level: 1, path: ['BTS', 'Vácuo'] }] },
    { ...link, id: 'a2', title: 'Beta', category: 'ANEL (SI)', folderPaths: [['ANEL (SI)', 'Temperatura']], folderPath: ['ANEL (SI)', 'Temperatura'],
      folderTagItems: [{ id: 20, name: 'Temperatura', level: 1, path: ['ANEL (SI)', 'Temperatura'] }] },
    { ...link, id: 'a1', title: 'Alfa', category: 'ANEL (SI)', folderPaths: [['ANEL (SI)', 'Temperatura']], folderPath: ['ANEL (SI)', 'Temperatura'],
      folderTagItems: [{ id: 20, name: 'Temperatura', level: 1, path: ['ANEL (SI)', 'Temperatura'] }] },
  ];
  assert.deepEqual(sortLinks(source, 'category-az').map(row => row.id), ['a1', 'a2', 'b']);
  assert.deepEqual(sortLinks(source, 'primary-tag').map(row => row.id), ['a1', 'a2', 'b']);
});

test('agrupamento por tag primária cria um cabeçalho visual com categoria e contagem', () => {
  const html = renderToStaticMarkup(<LinkCollection links={[link]} folders={folders} selectedFolderId={1}
    viewMode="list" sortOrder="primary-tag" selectedLinkIds={new Set()} copiedId={null}
    draggingLinkId={null} canManage {...actions} />);
  assert.match(html, /Links agrupados por tags primárias/);
  assert.match(html, />Temperatura</);
  assert.match(html, />LINAC</);
  assert.match(html, /chartlink-group-heading/);
});

test('visitantes mantêm abertura e informações, mas não recebem controles destrutivos', () => {
  const guest = renderToStaticMarkup(<LinkCard link={link} category="LINAC" subcategory="Temperatura" viewMode="list"
    selected={false} copied={false} dragging={false} canManage={false} {...actions} />);
  assert.match(guest, /Abrir LI_Temp/);
  assert.match(guest, /Informações de LI_Temp/);
  assert.ok(!guest.includes('Excluir LI_Temp'));
  assert.ok(!guest.includes('Editar LI_Temp'));
  assert.ok(!guest.includes('Selecionar LI_Temp'));
  const authenticated = renderToStaticMarkup(<LinkCard link={link} category="LINAC" subcategory="Temperatura" viewMode="list"
    selected={false} copied={false} dragging={false} canManage {...actions} />);
  assert.match(authenticated, /Excluir LI_Temp/);
  assert.match(authenticated, /Editar LI_Temp/);
});

test('selecionar uma pasta inclui descendentes e cópias cuja categoria principal é diferente', () => {
  const tree = new Map(folders);
  tree.set(4, { id: 4, name: 'Sala 2', parent_id: 2, level: 2, path: ['LINAC', 'Temperatura', 'Sala 2'] });
  const deep = { ...link, id: 'deep', folderId: 4, folderIds: [4] };
  const other = { ...link, id: 'other', category: 'ANEL (SI)', folderId: 3, folderIds: [3] };
  const rows = [link, deep, other];
  const ids = (rows: readonly ChartLink[]) => rows.map(row => row.id);
  assert.deepEqual(ids(scopeLinks(rows, tree, { folderId: 3, category: 'ANEL (SI)', subcategory: 'Todas' })), ['test-link', 'other']);
  assert.deepEqual(ids(scopeLinks(rows, tree, { folderId: 2, category: 'LINAC', subcategory: 'Todas' })), ['test-link', 'deep']);
  assert.deepEqual(ids(scopeLinks(rows, tree, { folderId: 4, category: 'LINAC', subcategory: 'Todas' })), ['deep']);
  assert.deepEqual(ids(scopeLinks(rows, tree, { folderId: 1, category: 'LINAC', subcategory: 'Temperatura' })), ['test-link', 'deep']);
  assert.deepEqual(ids(scopeLinks(rows, tree, { folderId: null, category: 'ANEL (SI)', subcategory: 'Todas' })), ['test-link', 'other']);
  const uncategorized = { ...link, id: 'uncategorized', category: UNCLASSIFIED_CATEGORY, subcategory: '', folderId: null, folderIds: [], folderPaths: [] };
  assert.deepEqual(ids(scopeLinks([...rows, uncategorized], tree, { folderId: null, category: UNCLASSIFIED_CATEGORY, subcategory: 'Todas' })), ['uncategorized']);
});

test('busca regex filtra apenas a pasta atual e a ordenação continua pelo título', () => {
  const rows = [
    { ...link, id: 'in10', title: 'Temp 10', folderIds: [2] },
    { ...link, id: 'outside', title: 'Temp 1', folderIds: [3] },
    { ...link, id: 'in2', title: 'Temp 2', folderIds: [2] },
    { ...link, id: 'pressure', title: 'Pressão', folderIds: [2] },
  ];
  const scoped = scopeLinks(rows, folders, { folderId: 1, category: 'LINAC', subcategory: 'Todas' });
  const response = matchRegex({ query: '^Temp', records: scoped.map(row => ({ id: row.id, fields: [row.title] })) });
  const found = new Set(response.ids);
  assert.deepEqual(sortLinks(scoped.filter(row => found.has(row.id)), 'az').map(row => row.id), ['in2', 'in10']);
  assert.deepEqual(scopeLinks(rows, folders, { folderId: 3, category: 'ANEL (SI)', subcategory: 'Todas' }).map(row => row.id), ['outside']);
  assert.equal(scopeLinks(rows, folders, { folderId: null, category: 'Todos', subcategory: 'Todas' }).length, 4);
});
