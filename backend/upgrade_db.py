"""Обновить структуру базы до текущей версии программы, НЕ удаляя данные (учеников, пароли, журнал).

    python upgrade_db.py

Безопасно запускать сколько угодно раз. Перед обновлением делается копия файла базы (для SQLite).
База, созданная старыми версиями без Alembic (seed.py / import_students.py), распознаётся по таблицам и столбцам.
"""

import shutil
import sys
from datetime import datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

from app.core.config import settings

HERE = Path(__file__).resolve().parent

# (признак схемы, ревизия Alembic) — от новых к старым
KNOWN = [
    (lambda t, c: "lessons" in t, "33651d8b707e"),  # учебная часть
    (lambda t, c: "full_name_latin" in c.get("students", ()) and "robi_id" not in c.get("students", ()), "1333f188dc1e"),
    (lambda t, c: "full_name_latin" in c.get("students", ()), "c29eaa43c4f0"),
    (lambda t, c: "enrollments" in t, "2a642bf22062"),
    (lambda t, c: "hik_access_states" in t, "f2fdc01cc2fb"),
    (lambda t, c: "access_events" in t, "cc9bf52b22d0"),
    (lambda t, c: "students" in t, "a47ec00e6a16"),
]


def sync_url() -> str:
    return settings.database_url.replace("+aiosqlite", "").replace("+asyncpg", "+psycopg2")


def main() -> None:
    cfg = Config(str(HERE / "alembic.ini"))
    cfg.set_main_option("script_location", str(HERE / "alembic"))

    engine = create_engine(sync_url())
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    columns = {t: {c["name"] for c in insp.get_columns(t)} for t in ("students",) if t in tables}
    with engine.connect() as conn:
        current = MigrationContext.configure(conn).get_current_revision()
    engine.dispose()
    head = ScriptDirectory.from_config(cfg).get_current_head()
    if current == head:
        print("База уже в актуальном состоянии.")
        return

    if settings.is_sqlite and tables:
        db = Path(settings.database_url.split("///", 1)[1])
        backup = db.with_name(f"{db.stem}.backup-{datetime.now():%Y%m%d-%H%M%S}{db.suffix}")
        shutil.copy2(db, backup)
        print(f"Копия базы перед обновлением: {backup.name}")

    if "alembic_version" not in tables and tables:
        rev = next((r for test, r in KNOWN if test(tables, columns)), None)
        if rev is None:
            sys.exit("Не удалось распознать версию базы. Обратитесь к разработчику.")
        print(f"База создана без миграций — помечаю как версию {rev}")
        command.stamp(cfg, rev)

    command.upgrade(cfg, "head")
    print("База обновлена до текущей версии. Данные сохранены.")


if __name__ == "__main__":
    main()
