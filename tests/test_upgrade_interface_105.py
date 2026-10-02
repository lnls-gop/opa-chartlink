import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class UpgradeInterface105Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "src/App.tsx").read_text(encoding="utf-8")
        cls.css = (ROOT / "src/chartlink-modern.css").read_text(encoding="utf-8")
        cls.card = (ROOT / "src/components/LinkCard.tsx").read_text(encoding="utf-8")
        cls.art = (ROOT / "src/components/CategoryArtwork.tsx").read_text(encoding="utf-8")
        cls.menu = (ROOT / "src/components/FolderActionsMenu.tsx").read_text(encoding="utf-8")
        cls.sidebar = (ROOT / "src/components/AnimatedSidebar.tsx").read_text(encoding="utf-8")

    def test_list_art_has_a_dedicated_responsive_column(self):
        self.assertIn("CategoryListEmblem", self.card)
        self.assertIn("chartlink-list-art-space", self.art)
        self.assertIn("grid-template-columns: 32px minmax(180px,1.15fr) minmax(220px,.9fr) 76px auto", self.css)
        self.assertIn("text-overflow: ellipsis", self.css)
        self.assertIn(".chartlink-list-art-space { display: none; }", self.css)

    def test_sidebar_has_room_for_names_and_totals(self):
        self.assertIn("SIDEBAR_MIN_WIDTH = 320", self.sidebar)
        self.assertIn("SIDEBAR_DEFAULT_WIDTH = 380", self.sidebar)

    def test_folder_menu_opens_on_the_right_and_closes_on_leave(self):
        self.assertIn("createPortal", self.menu)
        self.assertIn("left: rect.right + 8", self.menu)
        self.assertIn("onMouseLeave={scheduleClose}", self.menu)
        self.assertIn("position: fixed", self.css)

    def test_category_and_subcategory_counts_are_separate(self):
        self.assertIn("const categoryCount", self.app)
        self.assertIn("const subcategoryCount", self.app)
        self.assertIn("'categoria' : 'categorias'", self.app)
        self.assertIn("'subcategoria' : 'subcategorias'", self.app)
        self.assertNotIn("raiz ·", self.app)


if __name__ == "__main__":
    unittest.main()
