import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ThemeInterface106Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "src/App.tsx").read_text(encoding="utf-8")
        cls.css = (ROOT / "src/chartlink-modern.css").read_text(encoding="utf-8")
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.hook = (ROOT / "src/hooks/useTheme.ts").read_text(encoding="utf-8")
        cls.selector = (ROOT / "src/components/ThemeSelector.tsx").read_text(encoding="utf-8")

    def test_theme_is_applied_before_react_boots(self):
        self.assertIn("localStorage.getItem('chartlink.theme')", self.html)
        self.assertIn("prefers-color-scheme: dark", self.html)
        self.assertIn("document.documentElement.dataset.theme", self.html)

    def test_selector_has_light_dark_and_system_modes(self):
        for value in ["'light'", "'dark'", "'system'"]:
            self.assertIn(f"value: {value}", self.selector)
        self.assertIn("ThemeSelector", self.app)
        self.assertIn("setThemePreference", self.app)

    def test_system_mode_reacts_to_operating_system_changes(self):
        self.assertIn("matchMedia('(prefers-color-scheme: dark)')", self.hook)
        self.assertIn("media.addEventListener('change', synchronize)", self.hook)
        self.assertIn("localStorage.setItem(THEME_STORAGE_KEY, preference)", self.hook)

    def test_dark_theme_preserves_category_identity_with_readable_text(self):
        self.assertIn("html[data-theme='dark'] .chartlink-category-art", self.css)
        self.assertIn("html[data-theme='dark'] .chartlink-card-list", self.css)
        self.assertIn("#20252a", self.css)
        self.assertIn("color: #f4f4f5 !important", self.css)

    def test_dark_theme_covers_navigation_cards_forms_and_dialogs(self):
        for selector in [
            ".chartlink-app-header",
            ".chartlink-sidebar",
            ".chartlink-dialog-body",
            ".chartlink-link-card",
            "input:not([type='color'])",
            ".chartlink-folder-action-popover",
        ]:
            self.assertIn(selector, self.css)


if __name__ == "__main__":
    unittest.main()
