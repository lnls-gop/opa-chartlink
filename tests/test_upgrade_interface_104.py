import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class UpgradeInterface104Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "src/App.tsx").read_text(encoding="utf-8")
        cls.css = (ROOT / "src/chartlink-modern.css").read_text(encoding="utf-8")
        cls.art = (ROOT / "src/components/CategoryArtwork.tsx").read_text(encoding="utf-8")
        cls.menu = (ROOT / "src/components/FolderActionsMenu.tsx").read_text(encoding="utf-8")

    def test_favicon_is_declared_and_packaged(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('/chartlink-favicon.svg', html)
        self.assertTrue((ROOT / "public/chartlink-favicon.svg").is_file())

    def test_toolbar_copy_and_sort_options(self):
        self.assertNotIn("Selecionar visíveis", self.app)
        for label in ["Recentes (Data da criação)", "Categorias: A → Z", "Agrupar por tags primárias"]:
            self.assertIn(label, self.app)
        self.assertIn("bg-emerald-600", self.app)

    def test_tree_uses_context_menu_and_folder_plus(self):
        self.assertIn("MoreVertical", self.menu)
        self.assertIn("FolderPlus", self.menu)
        self.assertIn("Adicionar subcategoria", self.menu)
        self.assertIn("width: 0", self.css)
        self.assertNotIn("title=\"Nova subcategoria\"", self.app)

    def test_creation_dialog_uses_context_specific_copy(self):
        for label in [
            "Nome da {folderParentId === null ? 'categoria' : 'subcategoria'}",
            "Criar {folderParentId === null ? 'categoria' : 'subcategoria'}",
            "dentro da categoria selecionada",
            "dentro da subcategoria selecionada",
        ]:
            self.assertIn(label, self.app)

    def test_cards_have_full_grid_border_and_compact_list_with_emblem(self):
        self.assertIn(".chartlink-card-grid {", self.css)
        self.assertIn("border: 2px solid var(--chartlink-category-color", self.css)
        self.assertIn(".chartlink-card-grid::before { display: none; }", self.css)
        self.assertIn("min-height: 64px", self.css)
        self.assertIn("chartlink-art-emblem", self.art)
        self.assertIn("key === 'RAD' ? Radiation", self.art)


if __name__ == "__main__":
    unittest.main()
