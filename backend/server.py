"""ChartLink Manager – Backend Flask + SQLite."""
import sqlite3
import uuid
import time
import re
import os
from pathlib import Path
from flask import Flask, request, jsonify, g
from flask_cors import CORS

app = Flask(__name__)
allowed_origins = [value.strip() for value in os.environ.get("CHARTLINK_CORS_ORIGINS", "").split(",") if value.strip()]
if allowed_origins:
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})
DATABASE = str(Path(os.environ.get("CHARTLINK_DATABASE", str(Path(__file__).resolve().parent / "chartlink.db"))).expanduser().resolve())


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        require_existing = os.environ.get("CHARTLINK_REQUIRE_DATABASE", "0") == "1"
        target = Path(DATABASE).resolve().as_uri() + "?mode=rw" if require_existing else DATABASE
        db = g._database = sqlite3.connect(target, uri=require_existing, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def column_exists(db, table, column):
    return any(r[1] == column for r in db.execute("PRAGMA table_info(%s)" % table).fetchall())


@app.route("/api/health")
def health():
    try:
        get_db().execute("SELECT 1 FROM links LIMIT 1").fetchone()
        return jsonify({"status": "ok", "version": "1.0.0"})
    except (sqlite3.Error, OSError):
        return jsonify({"status": "unavailable"}), 503


def init_db():
    with app.app_context():
        db = get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS subcategories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                UNIQUE(name, category)
            );
            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
                created_at INTEGER NOT NULL,
                UNIQUE(name, parent_id)
            );
            CREATE TABLE IF NOT EXISTS links (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Geral',
                subcategory TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS link_folders (
                link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
                folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
                PRIMARY KEY (link_id, folder_id)
            );
        """)
        if not column_exists(db, "links", "subcategory"):
            db.execute("ALTER TABLE links ADD COLUMN subcategory TEXT NOT NULL DEFAULT ''")
        if not column_exists(db, "links", "folder_id"):
            db.execute("ALTER TABLE links ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL")
        if not column_exists(db, "folders", "color"):
            db.execute("ALTER TABLE folders ADD COLUMN color TEXT DEFAULT NULL")
        if not column_exists(db, "links", "updated_at"):
            # NULL preserva a ausência de histórico anterior à atualização.
            db.execute("ALTER TABLE links ADD COLUMN updated_at INTEGER DEFAULT NULL")

        # NÃO inserir categorias demonstrativas. A base existente é a fonte de verdade.
        # Em uma instalação vazia, a aplicação inicia sem categorias; elas podem ser
        # criadas pela interface. Isso evita substituir uma base ChartLink existente
        # por categorias genéricas como Financeiro/Marketing/Saúde etc.

        # Migra a taxonomia antiga Categoria -> Subcategoria para folders apenas uma vez.
        cat_rows = db.execute("SELECT name FROM categories ORDER BY id").fetchall()
        now = int(time.time() * 1000)
        for row in cat_rows:
            cat = row["name"]
            root = db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL", (cat,)).fetchone()
            if not root:
                cur = db.execute("INSERT INTO folders(name,parent_id,created_at) VALUES (?,NULL,?)", (cat, now))
                root_id = cur.lastrowid
            else:
                root_id = root["id"]
            subs = db.execute("SELECT name FROM subcategories WHERE category=? ORDER BY id", (cat,)).fetchall()
            for sub in subs:
                srow = db.execute("SELECT id FROM folders WHERE name=? AND parent_id=?", (sub["name"], root_id)).fetchone()
                if not srow:
                    db.execute("INSERT INTO folders(name,parent_id,created_at) VALUES (?,?,?)", (sub["name"], root_id, now))

        # Links legados: associa ao nó correspondente.
        rows = db.execute("SELECT id,category,subcategory,folder_id FROM links").fetchall()
        for link in rows:
            if link["folder_id"]:
                continue
            root = db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL", (link["category"],)).fetchone()
            if not root:
                continue
            folder_id = root["id"]
            if link["subcategory"]:
                sub = db.execute("SELECT id FROM folders WHERE name=? AND parent_id=?", (link["subcategory"], root["id"])).fetchone()
                if sub:
                    folder_id = sub["id"]
            db.execute("UPDATE links SET folder_id=? WHERE id=?", (folder_id, link["id"]))
            db.execute("INSERT OR IGNORE INTO link_folders(link_id,folder_id) VALUES (?,?)", (link["id"], folder_id))
        # Garante associações para Links já migrados.
        db.execute("INSERT OR IGNORE INTO link_folders(link_id,folder_id) SELECT id,folder_id FROM links WHERE folder_id IS NOT NULL")
        # Triggers cobrem também edição, movimentação e classificações pelas
        # rotas legadas. A primeira associação de um link novo não é uma edição.
        db.executescript("""
            CREATE TRIGGER IF NOT EXISTS chartlink_link_updated
            AFTER UPDATE OF title,url,description,category,subcategory,folder_id ON links
            WHEN NEW.title IS NOT OLD.title OR NEW.url IS NOT OLD.url
              OR NEW.description IS NOT OLD.description OR NEW.category IS NOT OLD.category
              OR NEW.subcategory IS NOT OLD.subcategory OR NEW.folder_id IS NOT OLD.folder_id
            BEGIN
                UPDATE links SET updated_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
                WHERE id=NEW.id;
            END;
            CREATE TRIGGER IF NOT EXISTS chartlink_classification_added
            AFTER INSERT ON link_folders
            WHEN (SELECT COUNT(*) FROM link_folders WHERE link_id=NEW.link_id)>1
            BEGIN
                UPDATE links SET updated_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
                WHERE id=NEW.link_id;
            END;
            CREATE TRIGGER IF NOT EXISTS chartlink_classification_removed
            AFTER DELETE ON link_folders
            BEGIN
                UPDATE links SET updated_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
                WHERE id=OLD.link_id;
            END;
            CREATE TRIGGER IF NOT EXISTS chartlink_folder_location_updated
            AFTER UPDATE OF name,parent_id ON folders
            WHEN NEW.name IS NOT OLD.name OR NEW.parent_id IS NOT OLD.parent_id
            BEGIN
                UPDATE links SET updated_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
                WHERE id IN (
                    WITH RECURSIVE tree(id) AS (
                        SELECT NEW.id UNION ALL
                        SELECT f.id FROM folders f JOIN tree t ON f.parent_id=t.id
                    ) SELECT link_id FROM link_folders WHERE folder_id IN tree
                );
            END;
        """)
        db.commit()


def folder_path(db, folder_id):
    parts = []
    current = folder_id
    while current:
        row = db.execute("SELECT id,name,parent_id FROM folders WHERE id=?", (current,)).fetchone()
        if not row:
            break
        parts.append(row["name"])
        current = row["parent_id"]
    return list(reversed(parts))


def folder_info(db, row):
    path = folder_path(db, row["id"])
    color = db.execute("SELECT color FROM folders WHERE id=?", (row["id"],)).fetchone()[0]
    return {"id": row["id"], "name": row["name"], "parent_id": row["parent_id"], "level": len(path)-1, "path": path, "color": color}


def sync_legacy_location(db, folder_id):
    if not folder_id:
        return "Sem categoria", ""
    path = folder_path(db, folder_id)
    return (path[0] if path else "Sem categoria", path[1] if len(path) > 1 else "")


def build_folder_cache(db):
    rows = db.execute("SELECT id,name,parent_id FROM folders ORDER BY id").fetchall()
    by_id = {r["id"]: {"id": r["id"], "name": r["name"], "parent_id": r["parent_id"]} for r in rows}
    cache = {}
    visiting = set()
    def path(fid):
        if fid in cache:
            return cache[fid]
        if fid in visiting or fid not in by_id:
            return []
        visiting.add(fid)
        node = by_id[fid]
        parent = node["parent_id"]
        result = (path(parent) if parent is not None else []) + [node["name"]]
        visiting.discard(fid)
        cache[fid] = result
        return result
    for fid in by_id:
        path(fid)
    return by_id, cache


def link_payload(db, row, folder_cache=None):
    d = dict(row)
    if folder_cache is None:
        _, folder_cache = build_folder_cache(db)
    ids = [r[0] for r in db.execute("SELECT folder_id FROM link_folders WHERE link_id=? ORDER BY folder_id", (row["id"],)).fetchall()]
    if not ids and row["folder_id"]:
        ids = [row["folder_id"]]
        db.execute("INSERT OR IGNORE INTO link_folders(link_id,folder_id) VALUES (?,?)", (row["id"], row["folder_id"]))
    paths = [folder_cache[fid] for fid in ids if fid in folder_cache]
    d["folder_id"] = row["folder_id"]
    d["folder_path"] = paths[0] if paths else []
    d["folder_ids"] = ids
    d["folder_paths"] = paths
    # Cada nó da taxonomia é uma TAG independente. Isso permite colorir e
    # identificar separadamente Categoria, Subcategoria 1, Subcategoria 2...
    seen = set()
    tag_items = []
    for path in paths:
        for level, name in enumerate(path):
            # resolve o id do nó pelo caminho; nomes iguais em ramos distintos
            # permanecem individualizados pelo caminho completo.
            key = (" / ".join(path[:level+1]))
            if key in seen:
                continue
            seen.add(key)
            fid = next((x for x, pth in folder_cache.items() if pth == path[:level+1]), None)
            tag_items.append({"id": fid, "name": name, "level": level, "path": path[:level+1]})
    d["folder_tag_items"] = tag_items
    d["folder_tags"] = [item["name"] for item in tag_items]
    return d


# ---------------------------------------------------------------------------
# Pastas hierárquicas
# ---------------------------------------------------------------------------
@app.route("/api/folders", methods=["GET"])
def list_folders():
    db = get_db()
    rows = db.execute("SELECT id,name,parent_id,color FROM folders ORDER BY parent_id IS NOT NULL, parent_id, name COLLATE NOCASE").fetchall()
    _, paths = build_folder_cache(db)
    # Uma única CTE calcula a contagem de Links para toda a árvore, evitando uma
    # consulta recursiva por pasta (N+1), que era uma das principais causas de lentidão.
    counts = {r["id"]: r["n"] for r in db.execute("""
        WITH RECURSIVE closure(root_id, descendant_id) AS (
            SELECT id, id FROM folders
            UNION ALL
            SELECT c.root_id, f.id FROM closure c JOIN folders f ON f.parent_id=c.descendant_id
        )
        SELECT c.root_id AS id, COUNT(DISTINCT lf.link_id) AS n
        FROM closure c LEFT JOIN link_folders lf ON lf.folder_id=c.descendant_id
        GROUP BY c.root_id
    """).fetchall()}
    result = []
    for row in rows:
        path = paths.get(row["id"], [])
        result.append({"id": row["id"], "name": row["name"], "parent_id": row["parent_id"],
                       "level": len(path)-1, "path": path, "link_count": counts.get(row["id"], 0), "color": row["color"]})
    return jsonify(result)


@app.route("/api/folders", methods=["POST"])
def create_folder():
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    parent_id = data.get("parentId")
    parent_id = int(parent_id) if parent_id not in (None, "", 0, "null") else None
    if not name:
        return jsonify({"error": "Nome da pasta é obrigatório"}), 400
    db = get_db()
    if parent_id is not None and not db.execute("SELECT 1 FROM folders WHERE id=?", (parent_id,)).fetchone():
        return jsonify({"error": "Pasta pai não encontrada"}), 404
    try:
        cur = db.execute("INSERT INTO folders(name,parent_id,created_at) VALUES (?,?,?)", (name, parent_id, int(time.time()*1000)))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Já existe uma pasta com esse nome neste nível"}), 409
    row = db.execute("SELECT id,name,parent_id FROM folders WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(folder_info(db, row)), 201


@app.route("/api/folders/<int:folder_id>/color", methods=["PUT"])
def update_folder_color(folder_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or "color" not in data:
        return jsonify({"error": "Informe uma cor ou null para herdar a cor."}), 400
    color = data["color"]
    if color is not None and (not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color)):
        return jsonify({"error": "Use uma cor hexadecimal de seis dígitos, como #56aeff."}), 400
    db = get_db()
    row = db.execute("SELECT id,name,parent_id FROM folders WHERE id=?", (folder_id,)).fetchone()
    if not row:
        return jsonify({"error": "Pasta não encontrada"}), 404
    db.execute("UPDATE folders SET color=? WHERE id=?", (color.lower() if color else None, folder_id))
    db.commit()
    return jsonify(folder_info(db, row))


@app.route("/api/folders/<int:folder_id>", methods=["PUT"])
def rename_folder(folder_id):
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Nome obrigatório"}), 400
    db = get_db()
    row = db.execute("SELECT id,name,parent_id FROM folders WHERE id=?", (folder_id,)).fetchone()
    if not row:
        return jsonify({"error": "Pasta não encontrada"}), 404
    try:
        db.execute("UPDATE folders SET name=? WHERE id=?", (name, folder_id))
        # Mantém a compatibilidade das duas colunas legadas para o primeiro nível.
        if row["parent_id"] is None:
            db.execute("UPDATE links SET category=? WHERE folder_id=?", (name, folder_id))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Já existe uma pasta com esse nome neste nível"}), 409
    newrow = db.execute("SELECT id,name,parent_id FROM folders WHERE id=?", (folder_id,)).fetchone()
    return jsonify(folder_info(db, newrow))


@app.route("/api/folders/<int:folder_id>/move", methods=["POST"])
def move_folder(folder_id):
    data = request.get_json() or {}
    parent_id = data.get("parentId")
    parent_id = int(parent_id) if parent_id not in (None, "", 0, "null") else None
    db = get_db()
    row = db.execute("SELECT id,name,parent_id FROM folders WHERE id=?", (folder_id,)).fetchone()
    if not row: return jsonify({"error":"Pasta não encontrada"}), 404
    if parent_id == folder_id: return jsonify({"error":"Uma pasta não pode ser movida para si mesma"}), 400
    if parent_id is not None and not db.execute("SELECT 1 FROM folders WHERE id=?", (parent_id,)).fetchone():
        return jsonify({"error":"Destino não encontrado"}), 404
    # Evita ciclos: o novo pai não pode estar na árvore da pasta movida.
    if parent_id is not None:
        cycle = db.execute("""WITH RECURSIVE tree(id) AS (SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN tree t ON f.parent_id=t.id) SELECT 1 FROM tree WHERE id=?""", (folder_id, parent_id)).fetchone()
        if cycle: return jsonify({"error":"Destino inválido: isso criaria um ciclo na árvore"}), 400
    try:
        db.execute("UPDATE folders SET parent_id=? WHERE id=?", (parent_id, folder_id))
        # Mantém as colunas legadas apontando para a nova categoria/subcategoria.
        cat, sub = sync_legacy_location(db, folder_id)
        affected_ids = [r[0] for r in db.execute("""WITH RECURSIVE tree(id) AS (
            SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN tree t ON f.parent_id=t.id
        ) SELECT DISTINCT lf.link_id FROM link_folders lf WHERE lf.folder_id IN tree""", (folder_id,)).fetchall()]
        db.execute("""WITH RECURSIVE tree(id) AS (SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN tree t ON f.parent_id=t.id)
                     UPDATE links SET category=?, subcategory=? WHERE folder_id IN tree""", (folder_id, cat, sub))
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback(); return jsonify({"error":"Já existe uma pasta com esse nome no destino"}), 409
    _, folder_cache = build_folder_cache(db)
    refreshed=[link_payload(db,r,folder_cache) for r in db.execute("SELECT * FROM links WHERE id IN (%s)" % (','.join('?' for _ in affected_ids)), affected_ids).fetchall()] if affected_ids else []
    return jsonify({"folder": folder_info(db, db.execute("SELECT id,name,parent_id FROM folders WHERE id=?", (folder_id,)).fetchone()), "links": refreshed})


@app.route("/api/folders/<int:folder_id>", methods=["DELETE"])
def delete_folder(folder_id):
    db = get_db()
    row = db.execute("SELECT id,name,parent_id FROM folders WHERE id=?", (folder_id,)).fetchone()
    if not row:
        return jsonify({"error": "Pasta não encontrada"}), 404
    # Captura os Links afetados antes de apagar associações, para atualizar somente
    # os registros necessários no frontend (em vez de recarregar a base inteira).
    affected_ids = [r[0] for r in db.execute("""WITH RECURSIVE tree(id) AS (
        SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN tree t ON f.parent_id=t.id
    ) SELECT DISTINCT lf.link_id FROM link_folders lf WHERE lf.folder_id IN tree""", (folder_id,)).fetchall()]
    db.execute("""WITH RECURSIVE tree(id) AS (SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN tree t ON f.parent_id=t.id)
                 DELETE FROM link_folders WHERE folder_id IN tree""", (folder_id,))
    db.execute("""UPDATE links SET folder_id=(SELECT lf.folder_id FROM link_folders lf WHERE lf.link_id=links.id ORDER BY lf.folder_id LIMIT 1)
                 WHERE id IN (%s)""" % (','.join('?' for _ in affected_ids),), affected_ids) if affected_ids else None
    db.execute("UPDATE links SET category='Sem categoria', subcategory='' WHERE id IN (%s) AND folder_id IS NULL" % (','.join('?' for _ in affected_ids),), affected_ids) if affected_ids else None
    if row["parent_id"] is None:
        db.execute("DELETE FROM subcategories WHERE category=?", (row["name"],))
        db.execute("DELETE FROM categories WHERE name=?", (row["name"],))
    db.execute("DELETE FROM folders WHERE id=?", (folder_id,))
    db.commit()
    _, folder_cache = build_folder_cache(db)
    refreshed=[link_payload(db,r,folder_cache) for r in db.execute("SELECT * FROM links WHERE id IN (%s)" % (','.join('?' for _ in affected_ids),), affected_ids).fetchall()] if affected_ids else []
    return jsonify({"deleted": folder_id, "destination": "Sem categoria", "links": refreshed})


# ---------------------------------------------------------------------------
# Categorias/subcategorias legadas (mantidas para importação e compatibilidade)
# ---------------------------------------------------------------------------
@app.route("/api/categories", methods=["GET"])
def list_categories():
    db = get_db()
    return jsonify([r["name"] for r in db.execute("SELECT name FROM categories ORDER BY id").fetchall()])


@app.route("/api/categories", methods=["POST"])
def add_category():
    data = request.get_json() or {}; name = str(data.get("name", "")).strip()
    if not name: return jsonify({"error":"Nome obrigatório"}),400
    db=get_db()
    try:
        db.execute("INSERT INTO categories(name) VALUES (?)",(name,))
        db.execute("INSERT INTO folders(name,parent_id,created_at) VALUES (?,NULL,?)",(name,int(time.time()*1000)))
        db.commit()
    except sqlite3.IntegrityError: return jsonify({"error":"Categoria já existe"}),409
    return jsonify({"name":name}),201


@app.route("/api/categories/<string:old_name>", methods=["PUT"])
def rename_category(old_name):
    data=request.get_json() or {}; new=str(data.get("newName","")).strip()
    if not new or new==old_name: return jsonify({"name":new})
    db=get_db()
    if db.execute("SELECT 1 FROM categories WHERE name=?",(new,)).fetchone(): return jsonify({"error":"Categoria já existe"}),409
    db.execute("UPDATE categories SET name=? WHERE name=?",(new,old_name))
    db.execute("UPDATE subcategories SET category=? WHERE category=?",(new,old_name))
    root=db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL",(old_name,)).fetchone()
    if root: db.execute("UPDATE folders SET name=? WHERE id=?",(new,root["id"]))
    db.execute("UPDATE links SET category=? WHERE category=?",(new,old_name)); db.commit()
    return jsonify({"oldName":old_name,"newName":new})


@app.route("/api/categories/<string:name>", methods=["DELETE"])
def delete_category(name):
    db=get_db(); root=db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL",(name,)).fetchone()
    if root:
        db.execute("""WITH RECURSIVE tree(id) AS (SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN tree t ON f.parent_id=t.id)
                     UPDATE links SET folder_id=NULL,category='Sem categoria',subcategory='' WHERE folder_id IN tree""",(root["id"],))
        db.execute("DELETE FROM folders WHERE id=?",(root["id"],))
    db.execute("UPDATE links SET category='Sem categoria',subcategory='' WHERE category=?",(name,))
    db.execute("DELETE FROM subcategories WHERE category=?",(name,)); cur=db.execute("DELETE FROM categories WHERE name=?",(name,)); db.commit()
    if not cur.rowcount:return jsonify({"error":"Categoria não encontrada"}),404
    return jsonify({"deleted":name,"destination":"Sem categoria"})


@app.route("/api/subcategories", methods=["GET"])
def list_subcategories():
    category=request.args.get("category"); db=get_db()
    sql="SELECT id,name,category FROM subcategories"; params=[]
    if category: sql+=" WHERE category=?"; params.append(category)
    sql+=" ORDER BY category,id"
    return jsonify([dict(r) for r in db.execute(sql,params).fetchall()])


@app.route("/api/subcategories", methods=["POST"])
def add_subcategory():
    data=request.get_json() or {}; name=str(data.get("name","")).strip(); category=str(data.get("category","")).strip()
    if not name or not category:return jsonify({"error":"Nome e categoria são obrigatórios"}),400
    db=get_db()
    try:
        cur=db.execute("INSERT INTO subcategories(name,category) VALUES (?,?)",(name,category))
        root=db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL",(category,)).fetchone()
        if not root: return jsonify({"error":"Categoria não encontrada"}),404
        db.execute("INSERT OR IGNORE INTO folders(name,parent_id,created_at) VALUES (?,?,?)",(name,root["id"],int(time.time()*1000)))
        db.commit(); return jsonify({"id":cur.lastrowid,"name":name,"category":category}),201
    except sqlite3.IntegrityError:return jsonify({"error":"Subcategoria já existe nesta categoria"}),409


@app.route("/api/subcategories/<int:sub_id>", methods=["PUT"])
def rename_subcategory(sub_id):
    data=request.get_json() or {}; name=str(data.get("name","")).strip(); db=get_db()
    row=db.execute("SELECT * FROM subcategories WHERE id=?",(sub_id,)).fetchone()
    if not row:return jsonify({"error":"Subcategoria não encontrada"}),404
    db.execute("UPDATE subcategories SET name=? WHERE id=?",(name,sub_id))
    root=db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL",(row["category"],)).fetchone()
    if root:
        folder=db.execute("SELECT id FROM folders WHERE name=? AND parent_id=?",(row["name"],root["id"])).fetchone()
        if folder: db.execute("UPDATE folders SET name=? WHERE id=?",(name,folder["id"]))
    db.execute("UPDATE links SET subcategory=? WHERE subcategory=? AND category=?",(name,row["name"],row["category"])); db.commit()
    return jsonify({"id":sub_id,"name":name,"category":row["category"]})


@app.route("/api/subcategories/<int:sub_id>", methods=["DELETE"])
def delete_subcategory(sub_id):
    db=get_db(); row=db.execute("SELECT * FROM subcategories WHERE id=?",(sub_id,)).fetchone()
    if not row:return jsonify({"error":"Não encontrada"}),404
    root=db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL",(row["category"],)).fetchone()
    if root:
        folder=db.execute("SELECT id FROM folders WHERE name=? AND parent_id=?",(row["name"],root["id"])).fetchone()
        if folder:
            db.execute("""WITH RECURSIVE tree(id) AS (SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN tree t ON f.parent_id=t.id)
                         UPDATE links SET folder_id=NULL,category='Sem categoria',subcategory='' WHERE folder_id IN tree""",(folder["id"],))
            db.execute("DELETE FROM folders WHERE id=?",(folder["id"],))
    db.execute("UPDATE links SET subcategory='',category='Sem categoria' WHERE subcategory=? AND category=?",(row["name"],row["category"]))
    db.execute("DELETE FROM subcategories WHERE id=?",(sub_id,)); db.commit(); return jsonify({"deleted":sub_id})


# ---------------------------------------------------------------------------
# Links
# ---------------------------------------------------------------------------
@app.route("/api/links", methods=["GET"])
def list_links():
    db = get_db()
    rows = db.execute("SELECT id,title,url,category,subcategory,description,created_at,updated_at,folder_id FROM links ORDER BY created_at DESC").fetchall()
    _, folder_cache = build_folder_cache(db)
    associations = {}
    for r in db.execute("SELECT link_id,folder_id FROM link_folders ORDER BY link_id,folder_id").fetchall():
        associations.setdefault(r["link_id"], []).append(r["folder_id"])
    result = []
    for row in rows:
        d = dict(row)
        ids = associations.get(row["id"], [])
        if not ids and row["folder_id"]:
            ids = [row["folder_id"]]
        paths = [folder_cache[fid] for fid in ids if fid in folder_cache]
        d["folder_ids"] = ids
        d["folder_paths"] = paths
        d["folder_path"] = paths[0] if paths else []
        seen = set(); tags=[]
        for path in paths:
            for level,name in enumerate(path):
                key=" / ".join(path[:level+1])
                if key in seen: continue
                seen.add(key)
                fid=next((x for x,pth in folder_cache.items() if pth == path[:level+1]), None)
                tags.append({"id":fid,"name":name,"level":level,"path":path[:level+1]})
        d["folder_tag_items"] = tags
        d["folder_tags"] = [x["name"] for x in tags]
        result.append(d)
    return jsonify(result)


def resolve_folder_id(db, data):
    if data.get("folderId") not in (None, "", 0):
        fid=int(data["folderId"])
        if not db.execute("SELECT 1 FROM folders WHERE id=?",(fid,)).fetchone(): raise ValueError("Pasta não encontrada")
        return fid
    category=str(data.get("category","Geral")).strip(); sub=str(data.get("subcategory","")).strip()
    root=db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL",(category,)).fetchone()
    if not root:return None
    if sub:
        child=db.execute("SELECT id FROM folders WHERE name=? AND parent_id=?",(sub,root["id"])).fetchone()
        if child:return child["id"]
    return root["id"]


@app.route("/api/links", methods=["POST"])
def create_link():
    data=request.get_json() or {}; title=str(data.get("title","")).strip(); url=str(data.get("url","")).strip()
    if not title or not url:return jsonify({"error":"Título e URL são obrigatórios"}),400
    db=get_db()
    try: folder_id=resolve_folder_id(db,data)
    except ValueError as e:return jsonify({"error":str(e)}),400
    cat,sub=sync_legacy_location(db,folder_id)
    lid=data.get("id") or str(uuid.uuid4()); created=data.get("createdAt") or int(time.time()*1000)
    db.execute("INSERT INTO links(id,title,url,category,subcategory,description,created_at,folder_id) VALUES (?,?,?,?,?,?,?,?)",(lid,title,url,cat,sub,str(data.get("description","")).strip(),created,folder_id))
    if folder_id:
        db.execute("INSERT OR IGNORE INTO link_folders(link_id,folder_id) VALUES (?,?)", (lid, folder_id))
    db.commit()
    return jsonify(link_payload(db,db.execute("SELECT * FROM links WHERE id=?",(lid,)).fetchone())),201


@app.route("/api/links/<string:link_id>", methods=["PUT"])
def update_link(link_id):
    data=request.get_json() or {}; title=str(data.get("title","")).strip(); url=str(data.get("url","")).strip()
    if not title or not url:return jsonify({"error":"Título e URL são obrigatórios"}),400
    db=get_db()
    try: folder_id=resolve_folder_id(db,data)
    except ValueError as e:return jsonify({"error":str(e)}),400
    cat,sub=sync_legacy_location(db,folder_id)
    cur=db.execute("UPDATE links SET title=?,url=?,category=?,subcategory=?,description=?,folder_id=? WHERE id=?",(title,url,cat,sub,str(data.get("description","")).strip(),folder_id,link_id))
    if not cur.rowcount:return jsonify({"error":"Link não encontrado"}),404
    db.execute("DELETE FROM link_folders WHERE link_id=?", (link_id,))
    if folder_id:
        db.execute("INSERT OR IGNORE INTO link_folders(link_id,folder_id) VALUES (?,?)", (link_id, folder_id))
    db.commit(); return jsonify(link_payload(db,db.execute("SELECT * FROM links WHERE id=?",(link_id,)).fetchone()))


@app.route("/api/links/<string:link_id>", methods=["DELETE"])
def delete_link(link_id):
    db=get_db(); cur=db.execute("DELETE FROM links WHERE id=?",(link_id,)); db.commit()
    if not cur.rowcount:return jsonify({"error":"Link não encontrado"}),404
    return jsonify({"deleted":link_id})


@app.route("/api/links/bulk-action", methods=["POST"])
def bulk_link_action():
    data=request.get_json() or {}; action=data.get("action"); ids=[str(x) for x in data.get("ids",[]) if x]
    if not ids:return jsonify({"error":"Nenhum link selecionado"}),400
    db=get_db(); ph=','.join('?' for _ in ids)
    if action=="delete":
        cur=db.execute("DELETE FROM links WHERE id IN (%s)"%ph,ids); db.commit(); return jsonify({"action":"delete","affected":cur.rowcount})
    try: fid=resolve_folder_id(db,data)
    except ValueError as e:return jsonify({"error":str(e)}),400
    if not fid:return jsonify({"error":"Destino de pasta obrigatório"}),400
    cat,sub=sync_legacy_location(db,fid)
    if action=="move":
        db.execute("DELETE FROM link_folders WHERE link_id IN (%s)"%ph,ids)
        db.executemany("INSERT OR IGNORE INTO link_folders(link_id,folder_id) VALUES (?,?)", [(i,fid) for i in ids])
        db.execute("UPDATE links SET folder_id=?,category=?,subcategory=? WHERE id IN (%s)"%ph,[fid,cat,sub,*ids]); db.commit()
        _, folder_cache = build_folder_cache(db)
        refreshed=[link_payload(db,r,folder_cache) for r in db.execute("SELECT * FROM links WHERE id IN (%s)"%ph,ids).fetchall()]
        return jsonify({"action":"move","affected":len(ids),"folderId":fid,"category":cat,"subcategory":sub,"path":folder_path(db,fid),"links":refreshed})
    if action=="copy":
        # Copiar significa adicionar uma nova classificação ao mesmo Link, sem duplicar o registro.
        existing={r[0] for r in db.execute("SELECT link_id FROM link_folders WHERE folder_id=? AND link_id IN (%s)"%ph,[fid,*ids]).fetchall()}
        db.executemany("INSERT OR IGNORE INTO link_folders(link_id,folder_id) VALUES (?,?)", [(i,fid) for i in ids])
        db.commit()
        refreshed=[link_payload(db,r) for r in db.execute("SELECT * FROM links WHERE id IN (%s)"%ph,ids).fetchall()]
        return jsonify({"action":"copy","affected":len(ids)-len(existing),"folderId":fid,"category":cat,"subcategory":sub,"path":folder_path(db,fid),"links":refreshed})
    return jsonify({"error":"Ação inválida"}),400


@app.route("/api/links/import", methods=["POST"])
def import_links():
    data=request.get_json() or {}; new_links=data.get("links",[]); cats=data.get("categories",[]); subs=data.get("subcategories",[])
    if not new_links:return jsonify({"error":"Nenhum link enviado"}),400
    db=get_db(); now=int(time.time()*1000)
    for cat in cats:
        db.execute("INSERT OR IGNORE INTO categories(name) VALUES (?)",(cat,))
        db.execute("INSERT OR IGNORE INTO folders(name,parent_id,created_at) VALUES (?,NULL,?)",(cat,now))
    for sub in subs:
        db.execute("INSERT OR IGNORE INTO subcategories(name,category) VALUES (?,?)",(sub["name"],sub["category"]))
        root=db.execute("SELECT id FROM folders WHERE name=? AND parent_id IS NULL",(sub["category"],)).fetchone()
        if root: db.execute("INSERT OR IGNORE INTO folders(name,parent_id,created_at) VALUES (?,?,?)",(sub["name"],root["id"],now))
    inserted=0
    for lnk in new_links:
        lid=lnk.get("id") or str(uuid.uuid4()); created=lnk.get("createdAt") or now
        try:
            fid=resolve_folder_id(db,lnk); cat,sub=sync_legacy_location(db,fid)
            db.execute("INSERT OR IGNORE INTO links(id,title,url,category,subcategory,description,created_at,folder_id) VALUES (?,?,?,?,?,?,?,?)",(lid,lnk.get("title",""),lnk.get("url",""),cat,sub,lnk.get("description",""),created,fid))
            if fid: db.execute("INSERT OR IGNORE INTO link_folders(link_id,folder_id) VALUES (?,?)", (lid, fid))
            inserted+=1
        except Exception: pass
    db.commit(); return jsonify({"imported":inserted})


if __name__=="__main__":
    init_db()
    print("ChartLink API de desenvolvimento: http://127.0.0.1:5000")
    app.run(debug=False, host="127.0.0.1", port=5000, use_reloader=False)
