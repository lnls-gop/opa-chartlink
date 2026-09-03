export interface ParsedBookmark {
  title: string;
  url: string;
  originalCategory: string;
  originalSubcategory: string;
}

export interface ParsedBookmarkFile {
  bookmarks: ParsedBookmark[];
  originalFolders: string[];
}

const IGNORE = new Set([
  'bookmarks toolbar', 'bookmarks menu', 'other bookmarks', 'mobile bookmarks',
  'menu de favoritos', 'barra de favoritos', 'outros favoritos',
  'favoritos para dispositivos moveis', 'favoritos para dispositivos móveis',
]);

export function parseBookmarkHtml(html: string): ParsedBookmarkFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const bookmarks: ParsedBookmark[] = [];
  const folders = new Set<string>();

  function walkDL(dl: Element, category: string, subcategory: string) {
    for (const child of Array.from(dl.children)) {
      if (child.tagName !== 'DT') continue;
      const h3 = Array.from(child.children).find(el => el.tagName === 'H3');
      const a = Array.from(child.children).find(el => el.tagName === 'A') as HTMLAnchorElement | undefined;
      const nested = Array.from(child.children).find(el => el.tagName === 'DL');

      if (h3) {
        const folder = (h3.textContent || '').trim();
        const ignored = IGNORE.has(folder.toLowerCase());
        if (!category) {
          const cat = ignored ? '' : folder;
          if (cat) folders.add(cat);
          if (nested) walkDL(nested, cat, '');
        } else {
          if (folder) folders.add(`${category} / ${folder}`);
          if (nested) walkDL(nested, category, folder);
        }
      } else if (a) {
        const url = a.getAttribute('href') || '';
        const title = (a.textContent || '').trim() || url;
        if (!url || url.toLowerCase().startsWith('place:')) continue;
        bookmarks.push({ title, url, originalCategory: category || '', originalSubcategory: subcategory || '' });
      }
    }
  }

  const root = doc.querySelector('DL');
  if (root) walkDL(root, '', '');
  return { bookmarks, originalFolders: Array.from(folders) };
}
