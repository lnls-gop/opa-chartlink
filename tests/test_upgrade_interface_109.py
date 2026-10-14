import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class UpgradeInterface109Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "src/App.tsx").read_text(encoding="utf-8")
        cls.css = (ROOT / "src/chartlink-modern.css").read_text(encoding="utf-8")
        cls.admin = (ROOT / "src/components/AdminUsersDialog.tsx").read_text(encoding="utf-8")
        cls.theme = (ROOT / "src/components/ThemeSelector.tsx").read_text(encoding="utf-8")
        cls.placeholder = (ROOT / "public/archiver-link-builder.html").read_text(encoding="utf-8")

    def test_admin_interface_edits_name_password_and_deletes_users(self):
        self.assertIn("Editar nome", self.admin)
        self.assertIn("Alterar senha", self.admin)
        self.assertIn("method: 'DELETE'", self.admin)
        self.assertIn("Você não pode excluir a própria conta", self.admin)

    def test_theme_control_has_three_icon_only_states(self):
        self.assertIn("role=\"group\"", self.theme)
        self.assertIn("aria-pressed", self.theme)
        self.assertNotIn("aria-haspopup=\"menu\"", self.theme)
        self.assertNotIn("chartlink-theme-trigger-label", self.theme)

    def test_sidebar_sorting_and_tree_lines_are_independent_and_aligned(self):
        self.assertIn("sortSidebarLinks", self.app)
        self.assertNotIn("sortLinks(links.filter(l => l.folderIds.includes(folder.id)), sortOrder)", self.app)
        self.assertIn("chartlink-tree-toggle", self.css)
        self.assertIn("chartlink-tree-children", self.css)
        self.assertIn("margin-left: 13px", self.css)

    def test_archiver_link_builder_has_header_button_and_placeholder(self):
        self.assertIn('href="archiver-link-builder.html"', self.app)
        self.assertIn("Archiver Link Builder", self.placeholder)
        self.assertIn("Em desenvolvimento", self.placeholder)
        self.assertIn("montar, configurar e gerar links do Archiver Viewer", self.placeholder)


if __name__ == "__main__":
    unittest.main()
