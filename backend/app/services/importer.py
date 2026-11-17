"""Импорт учеников из Excel (выгрузка HikCentral: ID, ФИО рус., ФИО лат., Класс).

Ключ ученика — ID из файла (= personId в HikCentral), а НЕ ФИО: в школе есть полные тёзки.
  * новый ID          → новый ученик (статус «Учится» — это уже обучающиеся, не новый приём);
  * известный ID      → обновить ФИО и класс (перевод в другой класс пишется в историю);
  * нет в файле       → только в отчёте, никого не удаляем;
  * новый класс       → создаётся автоматически.
dry_run=True — только показать, что будет сделано.
"""

import re
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SchoolClass, Student, StudentStatus, User
from app.services import presence
from app.services.enrollment import add_timeline

COLUMN_ALIASES = {
    "id": ("id", "ид", "номер", "person id", "personid"),
    "name": ("фио (рус.)", "фио (рус)", "фио", "ученик", "full name"),
    "latin": ("фио (лат.)", "фио (лат)", "фио латиница", "name (latin)"),
    "class": ("класс", "class", "группа"),
}


class ImportError_(Exception):
    pass


@dataclass
class ImportReport:
    sheet: str = ""
    rows: int = 0
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    moved: int = 0  # сменили класс
    classes_created: list[str] = field(default_factory=list)
    not_in_file: int = 0  # активные ученики с ID HikCentral, которых нет в файле
    warnings: list[str] = field(default_factory=list)
    dry_run: bool = True


def _norm(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()


def grade_of(class_name: str) -> int:
    """«10B» → 10, «Pre-School» → 0."""
    m = re.match(r"\d+", class_name)
    return int(m.group()) if m else 0


def _find_sheet(wb: openpyxl.Workbook) -> tuple[Any, dict[str, int]]:
    """Найти лист с учениками и номера нужных столбцов по заголовкам."""
    candidates = sorted(wb.worksheets, key=lambda ws: ws.title.lower() not in ("ученики", "students"))
    for ws in candidates:
        for header in ws.iter_rows(min_row=1, max_row=5, values_only=True):
            names = [_norm(h).lower() for h in header]
            cols = {}
            for key, aliases in COLUMN_ALIASES.items():
                for i, n in enumerate(names):
                    if n in aliases and key not in cols:
                        cols[key] = i
            if {"id", "name", "class"} <= cols.keys():
                return ws, cols
    raise ImportError_("Не найден лист со столбцами «ID», «ФИО», «Класс»")


def parse_students(data: bytes) -> tuple[str, list[dict[str, str]], list[str]]:
    try:
        wb = openpyxl.load_workbook(BytesIO(data), read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001 — битый или не тот формат файла
        raise ImportError_(f"Не удалось прочитать Excel: {type(e).__name__}") from None
    ws, cols = _find_sheet(wb)
    out, warnings, seen = [], [], set()
    header_passed = False
    for n, row in enumerate(ws.iter_rows(values_only=True), start=1):
        cells = list(row) + [None] * 10
        if not header_passed:
            header_passed = _norm(cells[cols["name"]]).lower() in COLUMN_ALIASES["name"]
            continue
        pid, name, cls = _norm(cells[cols["id"]]), _norm(cells[cols["name"]]), _norm(cells[cols["class"]])
        latin = _norm(cells[cols["latin"]]) if "latin" in cols else ""
        if not (pid or name or cls):
            continue
        if pid.endswith(".0"):  # Excel хранит числа как 123.0
            pid = pid[:-2]
        if not pid or not name or not cls:
            warnings.append(f"Строка {n}: пустой ID, ФИО или класс — пропущена")
            continue
        if pid in seen:
            warnings.append(f"Строка {n}: ID {pid} повторяется — пропущена")
            continue
        seen.add(pid)
        if len(name.split()) < 2:
            warnings.append(f"Строка {n}: ФИО из одного слова (ID {pid}) — проверьте")
        out.append({"id": pid, "name": name, "latin": latin, "class": cls})
    return ws.title, out, warnings


async def import_students(session: AsyncSession, data: bytes, actor: User | None, *, dry_run: bool) -> ImportReport:
    sheet, rows, warnings = parse_students(data)
    report = ImportReport(sheet=sheet, rows=len(rows), warnings=warnings, dry_run=dry_run)

    classes = {c.name: c for c in (await session.execute(select(SchoolClass))).scalars()}
    for name in sorted({r["class"] for r in rows} - classes.keys(), key=lambda x: (grade_of(x), x)):
        report.classes_created.append(name)
        if not dry_run:
            c = SchoolClass(name=name, grade_level=grade_of(name))
            session.add(c)
            classes[name] = c
    if not dry_run:
        await session.flush()

    existing = {s.hik_person_id: s for s in (await session.execute(
        select(Student).where(Student.hik_person_id.is_not(None)))).scalars()}
    for r in rows:
        s = existing.get(r["id"])
        if s is None:
            report.created += 1
            if not dry_run:
                s = Student(full_name=r["name"], full_name_latin=r["latin"] or None, hik_person_id=r["id"],
                            class_id=classes[r["class"]].id, status=StudentStatus.ACTIVE)
                session.add(s)
                await session.flush()
                await presence.get_or_create_state(session, s.id)
                add_timeline(session, s.id, actor, "student.imported", f"Загружен из Excel ({r['class']})")
            continue
        old_class = next((c for c in classes.values() if c.id == s.class_id), None)
        changed = False
        if old_class is None or old_class.name != r["class"]:
            report.moved += 1
            changed = True
            if not dry_run:
                add_timeline(session, s.id, actor, "student.updated",
                             f"Переведён из {old_class.name if old_class else '—'} в {r['class']} (импорт из Excel)")
                s.class_id = classes[r["class"]].id
        if s.full_name != r["name"] or (r["latin"] and s.full_name_latin != r["latin"]):
            changed = True
            if not dry_run:
                s.full_name, s.full_name_latin = r["name"], r["latin"] or s.full_name_latin
        report.updated += changed
        report.unchanged += not changed

    file_ids = {r["id"] for r in rows}
    report.not_in_file = sum(1 for pid, s in existing.items() if pid not in file_ids and s.status is StudentStatus.ACTIVE)
    if not dry_run:
        await session.flush()
    return report
