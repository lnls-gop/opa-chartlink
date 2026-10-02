import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DarkContrast107Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "src/App.tsx").read_text(encoding="utf-8")
        cls.css = (ROOT / "src/chartlink-modern.css").read_text(encoding="utf-8")
        cls.color_dialog = (ROOT / "src/components/FolderColorDialog.tsx").read_text(encoding="utf-8")

    def test_list_titles_and_category_paths_are_light(self):
        self.assertIn(".chartlink-card-list .chartlink-link-title", self.css)
        self.assertIn(".chartlink-card-list .chartlink-list-path", self.css)
        self.assertIn(".chartlink-category-art .chartlink-card-subcategory", self.css)
        self.assertNotIn(".chartlink-card-list .chartlink-list-path { color: #111827; }", self.css)

    def test_folder_and_subcategory_labels_override_legacy_black(self):
        self.assertIn("html[data-theme='dark'] .chartlink-folder-label", self.css)
        self.assertIn("html[data-theme='dark'] .chartlink-subcat-pill", self.css)
        self.assertIn("color: #f4f4f5 !important", self.css)

    def test_dynamic_pills_receive_theme_aware_inline_colors(self):
        self.assertIn("const darkTheme = resolvedTheme === 'dark'", self.app)
        self.assertIn("darkTheme ? '#f4f4f5'", self.app)
        self.assertIn("resolvedTheme === 'dark'", self.app)

    def test_category_manager_selected_rows_are_dark_tinted(self):
        self.assertIn("html[data-theme='dark'] .bg-emerald-50", self.css)
        self.assertIn("rgba(16,185,129,.14)", self.css)
        self.assertIn("chartlink-folder-label truncate", self.app)

    def test_other_dialog_tags_and_black_utilities_are_readable(self):
        self.assertIn(".chartlink-info-tag", self.css)
        self.assertIn(".chartlink-app .text-black", self.css)
        self.assertIn(".chartlink-dialog-body .chartlink-link-title", self.css)
        self.assertIn(".chartlink-group-heading", self.css)
        self.assertIn("O contraste dos textos é ajustado ao tema", self.color_dialog)


if __name__ == "__main__":
    unittest.main()
