"""Importação inicial e snapshots SQLite; nunca substitui um banco existente."""
import argparse
import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path


def inspect_database(connection):
    check = connection.execute("PRAGMA quick_check").fetchall()
    if check != [("ok",)]:
        raise ValueError("O banco não passou na verificação de integridade: %s" % check)
    columns = {row[1] for row in connection.execute("PRAGMA table_info(links)")}
    if not {"id", "title", "url", "created_at"}.issubset(columns):
        raise ValueError("O arquivo não contém a tabela links esperada do ChartLink.")
    return {"links": connection.execute("SELECT COUNT(*) FROM links").fetchone()[0]}


def snapshot(source, destination):
    source, destination = Path(source).resolve(), Path(destination).absolute()
    if not source.is_file():
        raise FileNotFoundError("Banco de origem não encontrado: %s" % source)
    if destination.exists() or destination.is_symlink():
        raise FileExistsError("O destino já existe e foi preservado: %s" % destination)
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix=".chartlink-", suffix=".tmp", dir=str(destination.parent))
    os.close(fd)
    temporary = Path(name)
    try:
        with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True, timeout=30) as original:
            inspect_database(original)
            with sqlite3.connect(str(temporary)) as copied:
                original.backup(copied, pages=256, sleep=0.05)
                result = inspect_database(copied)
        os.chmod(temporary, 0o600)
        # Publica de forma atômica e exclusiva; um destino criado em paralelo
        # também não pode ser sobrescrito.
        os.link(str(temporary), str(destination))
        return result
    finally:
        temporary.unlink(missing_ok=True)


def backup_name():
    return "chartlink_%s_%s.db" % (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"), uuid.uuid4().hex[:8])


def set_owner(paths, owner):
    if owner is None:
        return
    if os.geteuid() != 0:
        raise PermissionError("A preparação de permissões deve rodar como root dentro do container.")
    for path in paths:
        os.chown(str(path), owner, owner)


def import_database(source, data_dir, backup_dir, owner=None):
    data_dir, backup_dir = Path(data_dir), Path(backup_dir)
    target = data_dir / "chartlink.db"
    if target.exists() or target.is_symlink():
        raise FileExistsError("Já existe um banco em %s. Nenhum dado foi substituído." % target)
    # Confere a origem antes de preparar qualquer cópia.
    if not Path(source).is_file():
        raise FileNotFoundError("Banco de origem não encontrado: %s" % source)
    data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup = backup_dir / backup_name()
    snapshot(source, backup)
    result = snapshot(backup, target)
    set_owner([data_dir, backup_dir, target, backup], owner)
    return dict(result, database=str(target), backup=str(backup))


def init_empty(data_dir, backup_dir, owner=None):
    data_dir, backup_dir = Path(data_dir), Path(backup_dir)
    target = data_dir / "chartlink.db"
    if target.exists() or target.is_symlink():
        raise FileExistsError("O banco existente foi preservado: %s" % target)
    data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix=".chartlink-", suffix=".tmp", dir=str(data_dir))
    os.close(fd)
    import server
    previous = server.DATABASE
    try:
        server.DATABASE = name
        server.init_db()
        with sqlite3.connect(name) as connection:
            result = inspect_database(connection)
        os.link(name, str(target))
        set_owner([data_dir, backup_dir, target], owner)
        return dict(result, database=str(target))
    finally:
        server.DATABASE = previous
        Path(name).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["import-db", "init-empty", "backup"])
    parser.add_argument("--source")
    parser.add_argument("--data-dir", default="/data")
    parser.add_argument("--backup-dir", default=os.environ.get("CHARTLINK_BACKUP_DIR", "/backups"))
    parser.add_argument("--owner", type=int)
    args = parser.parse_args()
    try:
        if args.action == "import-db":
            if not args.source:
                parser.error("import-db exige --source com o banco atual")
            result = import_database(args.source, args.data_dir, args.backup_dir, args.owner)
        elif args.action == "init-empty":
            result = init_empty(args.data_dir, args.backup_dir, args.owner)
        else:
            source = args.source or os.environ.get("CHARTLINK_DATABASE", "/data/chartlink.db")
            destination = Path(args.backup_dir) / backup_name()
            result = dict(snapshot(source, destination), backup=str(destination))
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, "Erro: %s\n" % error)


if __name__ == "__main__":
    main()
