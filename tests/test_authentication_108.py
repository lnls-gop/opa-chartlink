"""Autenticação, autorização, CSRF, lixeira e auditoria da versão 1.0.8."""
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import server


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous_database = server.DATABASE
        self.database = Path(self.temp.name) / "chartlink.db"
        server.DATABASE = str(self.database)
        server.init_db()
        now = int(time.time() * 1000)
        with sqlite3.connect(str(self.database)) as db:
            db.execute(
                """INSERT INTO users(username,display_name,password_hash,role,active,must_change_password,created_at,updated_at)
                   VALUES (?,?,?,?,1,0,?,?)""",
                ("admin", "Administrador", server.PASSWORD_HASHER.hash("frase segura de teste 123"), "admin", now, now),
            )
            db.execute(
                """INSERT INTO users(username,display_name,password_hash,role,active,must_change_password,created_at,updated_at)
                   VALUES (?,?,?,?,1,0,?,?)""",
                ("operador", "Operador", server.PASSWORD_HASHER.hash("outra frase segura 456"), "user", now, now),
            )

    def tearDown(self):
        server.DATABASE = self.previous_database
        self.temp.cleanup()

    def client_with_csrf(self):
        client = server.app.test_client()
        token = client.get("/api/auth/session").get_json()["csrfToken"]
        return client, token

    def login(self, username="operador", password="outra frase segura 456"):
        client, token = self.client_with_csrf()
        response = client.post("/api/auth/login", json={"username": username, "password": password}, headers={"X-CSRF-Token": token})
        self.assertEqual(response.status_code, 200, response.get_json())
        return client, response.get_json()["csrfToken"]

    def create_public_link(self, client, token, title="Link público"):
        response = client.post("/api/links", json={"title": title, "url": "https://example.org/plot"}, headers={"X-CSRF-Token": token})
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()

    def test_public_creation_requires_csrf_but_not_login(self):
        client, token = self.client_with_csrf()
        self.assertFalse(client.get("/api/auth/session").get_json()["authenticated"])
        self.assertEqual(client.post("/api/links", json={"title": "Sem token", "url": "https://example.org"}).status_code, 400)
        link = self.create_public_link(client, token)
        self.assertEqual(client.put("/api/links/" + link["id"], json={"title": "Tentativa", "url": link["url"]}, headers={"X-CSRF-Token": token}).status_code, 401)

    def test_login_edit_trash_restore_and_audit(self):
        guest, guest_token = self.client_with_csrf()
        link = self.create_public_link(guest, guest_token)
        client, token = self.login()
        edited = client.put("/api/links/" + link["id"], json={"title": "Editado", "url": link["url"]}, headers={"X-CSRF-Token": token})
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(client.delete("/api/links/" + link["id"], headers={"X-CSRF-Token": token}).status_code, 200)
        self.assertEqual(guest.get("/api/links").get_json(), [])
        trash = client.get("/api/trash/links").get_json()
        self.assertEqual(trash[0]["title"], "Editado")
        self.assertEqual(client.delete("/api/trash/links/" + link["id"], headers={"X-CSRF-Token": token}).status_code, 403)
        self.assertEqual(client.post("/api/trash/links/" + link["id"] + "/restore", headers={"X-CSRF-Token": token}).status_code, 200)
        self.assertEqual(guest.get("/api/links").get_json()[0]["title"], "Editado")
        admin, admin_token = self.login("admin", "frase segura de teste 123")
        actions = [row["action"] for row in admin.get("/api/admin/audit").get_json()]
        self.assertIn("link_trashed", actions)
        self.assertIn("link_restored", actions)

    def test_admin_can_purge_and_manage_users(self):
        guest, guest_token = self.client_with_csrf()
        link = self.create_public_link(guest, guest_token)
        admin, token = self.login("admin", "frase segura de teste 123")
        admin.delete("/api/links/" + link["id"], headers={"X-CSRF-Token": token})
        self.assertEqual(admin.delete("/api/trash/links/" + link["id"], headers={"X-CSRF-Token": token}).status_code, 200)
        created = admin.post("/api/admin/users", json={
            "username": "novo.usuario", "displayName": "Novo Usuário",
            "password": "senha temporaria muito forte", "role": "user",
        }, headers={"X-CSRF-Token": token})
        self.assertEqual(created.status_code, 201, created.get_json())
        self.assertTrue(any(row["username"] == "novo.usuario" for row in admin.get("/api/admin/users").get_json()))

    def test_last_admin_cannot_be_disabled_or_demote_itself(self):
        admin, token = self.login("admin", "frase segura de teste 123")
        current = admin.get("/api/auth/session").get_json()["user"]
        common = {"displayName": "Administrador", "role": "admin", "active": False}
        disabled = admin.put(f"/api/admin/users/{current['id']}", json=common, headers={"X-CSRF-Token": token})
        self.assertEqual(disabled.status_code, 409)
        demoted = admin.put(f"/api/admin/users/{current['id']}", json={**common, "active": True, "role": "user"}, headers={"X-CSRF-Token": token})
        self.assertEqual(demoted.status_code, 409)

    def test_executable_protocols_are_rejected_on_create_and_update(self):
        guest, guest_token = self.client_with_csrf()
        rejected = guest.post("/api/links", json={"title": "Perigoso", "url": "javascript:alert(1)"}, headers={"X-CSRF-Token": guest_token})
        self.assertEqual(rejected.status_code, 400)
        link = self.create_public_link(guest, guest_token)
        client, token = self.login()
        rejected = client.put("/api/links/" + link["id"], json={"title": "Perigoso", "url": "data:text/html,x"}, headers={"X-CSRF-Token": token})
        self.assertEqual(rejected.status_code, 400)

    def test_temporary_password_must_be_changed(self):
        admin, token = self.login("admin", "frase segura de teste 123")
        created = admin.post("/api/admin/users", json={
            "username": "temporario", "displayName": "Temporário",
            "password": "primeira senha temporaria", "role": "user",
        }, headers={"X-CSRF-Token": token})
        self.assertEqual(created.status_code, 201)
        client, token = self.login("temporario", "primeira senha temporaria")
        blocked = client.post("/api/folders", json={"name": "Bloqueado"}, headers={"X-CSRF-Token": token})
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.get_json()["code"], "password_change_required")
        changed = client.post("/api/auth/change-password", json={
            "currentPassword": "primeira senha temporaria", "newPassword": "segunda senha definitiva 789",
        }, headers={"X-CSRF-Token": token})
        self.assertEqual(changed.status_code, 200, changed.get_json())
        token = changed.get_json()["csrfToken"]
        self.assertEqual(client.post("/api/folders", json={"name": "Permitido"}, headers={"X-CSRF-Token": token}).status_code, 201)

    def test_failed_logins_lock_account_temporarily(self):
        previous = server.LOGIN_MAX_FAILURES
        server.LOGIN_MAX_FAILURES = 2
        try:
            client, token = self.client_with_csrf()
            for _ in range(2):
                response = client.post("/api/auth/login", json={"username": "operador", "password": "senha errada"}, headers={"X-CSRF-Token": token})
                self.assertEqual(response.status_code, 401)
            correct = client.post("/api/auth/login", json={"username": "operador", "password": "outra frase segura 456"}, headers={"X-CSRF-Token": token})
            self.assertEqual(correct.status_code, 401)
        finally:
            server.LOGIN_MAX_FAILURES = previous


if __name__ == "__main__":
    unittest.main()
