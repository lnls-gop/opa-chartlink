import importlib.util
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import server

spec = importlib.util.spec_from_file_location("database_ops", ROOT / "scripts/database.py")
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


class ProductionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.previous = server.DATABASE

    def tearDown(self):
        server.DATABASE = self.previous
        self.temp.cleanup()

    def legacy_source(self):
        source = self.root / "source with spaces.db"
        with sqlite3.connect(str(source)) as db:
            db.execute("CREATE TABLE links(id TEXT PRIMARY KEY, title TEXT, url TEXT, created_at INTEGER)")
            db.execute("INSERT INTO links VALUES ('1','Example','https://example.org',1700000000000)")
        return source

    def test_verified_import_preserves_source_and_refuses_overwrite(self):
        source = self.legacy_source()
        before = source.read_bytes()
        result = ops.import_database(source, self.root / "data", self.root / "backups")
        self.assertEqual(result["links"], 1)
        self.assertEqual(source.read_bytes(), before)
        self.assertTrue(Path(result["backup"]).is_file())
        target = Path(result["database"])
        target_before = target.read_bytes()
        with self.assertRaises(FileExistsError):
            ops.import_database(source, self.root / "data", self.root / "backups")
        self.assertEqual(target.read_bytes(), target_before)

    def test_snapshot_includes_committed_wal_data_and_rejects_missing_or_invalid_source(self):
        source = self.legacy_source()
        with sqlite3.connect(str(source)) as writer:
            writer.execute("PRAGMA journal_mode=WAL")
            writer.execute("INSERT INTO links VALUES ('2','New','https://example.org/new',1700000001000)")
            writer.commit()
            result = ops.snapshot(source, self.root / "snapshot.db")
            self.assertEqual(result["links"], 2)
        with self.assertRaises(FileNotFoundError):
            ops.snapshot(self.root / "missing.db", self.root / "should-not-exist.db")
        self.assertFalse((self.root / "missing.db").exists())
        invalid = self.root / "invalid.db"
        invalid.write_text("not a database")
        with self.assertRaises(sqlite3.Error):
            ops.snapshot(invalid, self.root / "invalid-copy.db")
        self.assertFalse((self.root / "invalid-copy.db").exists())

    def test_production_does_not_silently_create_database_and_writes_persist(self):
        target = self.root / "data/chartlink.db"
        target.parent.mkdir()
        with patch.dict(os.environ, {"CHARTLINK_REQUIRE_DATABASE": "1"}):
            server.DATABASE = str(target)
            self.assertEqual(server.app.test_client().get("/api/health").status_code, 503)
            self.assertFalse(target.exists())
            ops.init_empty(target.parent, self.root / "backups")
            server.init_db()
            client = server.app.test_client()
            self.assertEqual(client.get("/api/health").status_code, 200)
            self.assertFalse(server.app.debug)
            csrf = client.get('/api/auth/session').get_json()['csrfToken']
            client.post("/api/links", json={"title": "Persisted", "url": "https://example.org"}, headers={'X-CSRF-Token': csrf})
            server.init_db()
            self.assertEqual(client.get("/api/links").get_json()[0]["title"], "Persisted")
            self.assertNotIn("Access-Control-Allow-Origin", client.get("/api/links", headers={"Origin": "https://other.example"}).headers)


if __name__ == "__main__":
    unittest.main()
