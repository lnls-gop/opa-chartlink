"""Regressões de migração, cores e datas. Sempre usa bancos temporários."""
import importlib.util
import shutil
import sqlite3
import tempfile
import unittest
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('chartlink_server', ROOT / 'backend/server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / 'test.db'
        server.DATABASE = str(self.database)
        server.init_db()
        with server.app.app_context():
            now = int(time.time() * 1000)
            server.get_db().execute(
                """INSERT INTO users(username,display_name,password_hash,role,active,must_change_password,created_at,updated_at)
                   VALUES ('tester','Test Admin',?,'admin',1,0,?,?)""",
                (server.PASSWORD_HASHER.hash('senha-de-teste-segura'), now, now),
            )
            server.get_db().commit()
        self.client = server.app.test_client()
        csrf = self.client.get('/api/auth/session').get_json()['csrfToken']
        login = self.client.post('/api/auth/login', json={'username': 'tester', 'password': 'senha-de-teste-segura'}, headers={'X-CSRF-Token': csrf})
        self.headers = {'X-CSRF-Token': login.get_json()['csrfToken']}
        self.root = self.client.post('/api/folders', json={'name': 'TEST ROOT'}, headers=self.headers).get_json()['id']
        self.child = self.client.post('/api/folders', json={'name': 'Child', 'parentId': self.root}, headers=self.headers).get_json()['id']

    def tearDown(self):
        self.temp.cleanup()

    def create_link(self):
        response = self.client.post('/api/links', json={'id': 'client-must-not-choose-id', 'title': 'Test link', 'url': 'https://example.org/plot', 'folderId': self.child}, headers=self.headers)
        self.assertEqual(response.status_code, 201)
        link = response.get_json()
        self.assertNotEqual(link['id'], 'client-must-not-choose-id')
        return link

    def test_bulk_import_also_assigns_ids_on_the_server(self):
        response = self.client.post('/api/links/import', json={'links': [
            {'id': 'csv-client-id', 'title': 'CSV link', 'url': 'https://example.org/csv', 'folderId': self.child},
            {'id': 'favorite-client-id', 'title': 'Favorite link', 'url': 'https://example.org/favorite', 'folderId': self.child},
        ]}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['imported'], 2)
        imported = {row['title']: row['id'] for row in self.client.get('/api/links').get_json()}
        self.assertNotEqual(imported['CSV link'], 'csv-client-id')
        self.assertNotEqual(imported['Favorite link'], 'favorite-client-id')

    def test_color_persistence_validation_reset(self):
        endpoint = '/api/folders/{}/color'.format(self.root)
        self.assertEqual(self.client.put(endpoint, json={'color': '#Ab12EF'}, headers=self.headers).get_json()['color'], '#ab12ef')
        for value in ['red', '#fff', '#12345g', 123, {}, 'url(javascript:alert(1))']:
            self.assertEqual(self.client.put(endpoint, json={'color': value}, headers=self.headers).status_code, 400)
        self.assertEqual(self.client.put(endpoint, json={}, headers=self.headers).status_code, 400)
        self.assertEqual(self.client.put('/api/folders/999999/color', json={'color': '#123456'}, headers=self.headers).status_code, 404)
        server.init_db()
        folders = {f['id']: f for f in self.client.get('/api/folders').get_json()}
        self.assertEqual(folders[self.root]['color'], '#ab12ef')
        self.assertIsNone(folders[self.child]['color'])
        self.assertIsNone(self.client.put(endpoint, json={'color': None}, headers=self.headers).get_json()['color'])

    def test_creation_edit_copy_and_folder_changes(self):
        link = self.create_link()
        self.assertIsNone(link['updated_at'])
        payload = {'title': 'Edited link', 'url': link['url'], 'folderId': self.child, 'description': 'Updated description'}
        updated = self.client.put('/api/links/' + link['id'], json=payload, headers=self.headers).get_json()
        self.assertEqual(updated['created_at'], link['created_at'])
        self.assertIsInstance(updated['updated_at'], int)
        self.assertGreaterEqual(updated['updated_at'], link['created_at'] - 1)
        before = updated['updated_at']
        self.client.put('/api/folders/{}/color'.format(self.child), json={'color': '#000000'}, headers=self.headers)
        after = next(l for l in self.client.get('/api/links').get_json() if l['id'] == link['id'])
        self.assertEqual(after['updated_at'], before, 'Cor não é edição do conteúdo do link')
        copy = self.client.post('/api/links/bulk-action', json={'action': 'copy', 'ids': [link['id']], 'folderId': self.root}, headers=self.headers).get_json()
        self.assertEqual(copy['affected'], 1)
        self.assertEqual(copy['links'][0]['created_at'], link['created_at'])
        self.assertIsInstance(copy['links'][0]['updated_at'], int)
        self.assertEqual(self.client.put('/api/folders/{}'.format(self.child), json={'name': 'Renamed child'}, headers=self.headers).status_code, 200)
        self.assertEqual(self.client.post('/api/links/bulk-action', json={'action': 'move', 'ids': [link['id']], 'folderId': self.root}, headers=self.headers).status_code, 200)
        self.assertEqual(self.client.delete('/api/folders/{}'.format(self.root), headers=self.headers).status_code, 200)
        final = next(l for l in self.client.get('/api/links').get_json() if l['id'] == link['id'])
        self.assertEqual(final['created_at'], link['created_at'])
        self.assertEqual(final['category'], 'Links não classificados')
        self.assertIsInstance(final['updated_at'], int)

    def test_legacy_database_migration_is_idempotent(self):
        original = Path(self.temp.name) / 'legacy.db'
        with sqlite3.connect(str(original)) as legacy:
            legacy.executescript('''
                CREATE TABLE categories(id INTEGER PRIMARY KEY, name TEXT UNIQUE);
                CREATE TABLE subcategories(id INTEGER PRIMARY KEY, name TEXT, category TEXT, UNIQUE(name,category));
                CREATE TABLE folders(id INTEGER PRIMARY KEY, name TEXT, parent_id INTEGER, created_at INTEGER, UNIQUE(name,parent_id));
                CREATE TABLE links(id TEXT PRIMARY KEY, title TEXT, url TEXT, category TEXT, subcategory TEXT, description TEXT, created_at INTEGER, folder_id INTEGER);
                INSERT INTO categories VALUES(1,'EXAMPLE');
                INSERT INTO subcategories VALUES(1,'Child','EXAMPLE');
                INSERT INTO folders VALUES(1,'EXAMPLE',NULL,1700000000000);
                INSERT INTO folders VALUES(2,'Child',1,1700000000000);
                INSERT INTO links VALUES('legacy','Example link','https://example.org','EXAMPLE','Child','',1700000000000,NULL);
                INSERT INTO links VALUES('orphan','Orphan link','https://example.org/orphan','Sem categoria','', '',1700000000001,NULL);
            ''')
        shutil.copyfile(original, self.database)
        with sqlite3.connect(str(self.database)) as db:
            before_links = db.execute('SELECT id,title,url,created_at FROM links ORDER BY id').fetchall()
            before_folders = db.execute('SELECT id,name,parent_id FROM folders ORDER BY id').fetchall()
        server.init_db()
        server.init_db()
        with sqlite3.connect(str(self.database)) as db:
            self.assertEqual(before_links, db.execute('SELECT id,title,url,created_at FROM links ORDER BY id').fetchall())
            self.assertEqual(before_folders, db.execute('SELECT id,name,parent_id FROM folders ORDER BY id').fetchall())
            self.assertEqual(db.execute('SELECT COUNT(*) FROM links WHERE updated_at IS NOT NULL').fetchone()[0], 0)
            migrated = db.execute("SELECT category,subcategory,folder_id FROM links WHERE id='legacy'").fetchone()
            self.assertEqual(migrated, ('EXAMPLE', 'Child', 2))
            orphan = db.execute("SELECT category,subcategory,folder_id FROM links WHERE id='orphan'").fetchone()
            self.assertEqual(orphan, ('Links não classificados', '', None))
        for endpoint in ['links', 'folders', 'categories', 'subcategories']:
            self.assertEqual(self.client.get('/api/' + endpoint).status_code, 200)


if __name__ == '__main__':
    unittest.main()
