"""Импорт сотрудников из Excel (лист «Сотрудники» выгрузки HikCentral: ID, ФИО рус., ФИО лат., Отдел).

* Ключ — ID из HikCentral (User.hik_person_id): повторная загрузка обновляет ФИО и отдел, не трогая
  назначенную администратором роль, почту и пароль.
* Роль по отделу задаётся сопоставлением (mapping): «Учителя» → Teacher, «Администрация» → Staff (роль
  назначит администратор), «Столовая персонал» → не создавать и т.д.
* Логин: фамилия.имя латиницей @домен; при совпадении добавляется номер. Пароль — временный случайный.
"""

import asyncio
import re
import secrets
from dataclasses import dataclass, field
from io import BytesIO

import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import User, UserRole

SKIP = "SKIP"
DEFAULT_MAPPING = {
    "учителя": UserRole.TEACHER.value,
    "администрация": UserRole.STAFF.value,
    "менеджер": UserRole.STAFF.value,
    "столовая персонал": SKIP,
    "технический персонал": SKIP,
}
ALIASES = {"id": ("id", "ид", "номер"), "name": ("фио (рус.)", "фио (рус)", "фио"),
           "latin": ("фио (лат.)", "фио (лат)", "фио латиница"), "dept": ("отдел", "должность", "подразделение")}
TRANSLIT = str.maketrans({"ʻ": "", "'": "", "`": "", "’": "", "ʼ": ""})
# Кириллица (русская и узбекская) → латиница — если в «ФИО (лат.)» попала кириллица
CYR = {"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "j", "з": "z", "и": "i", "й": "y",
       "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f",
       "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh", "ъ": "", "ы": "i", "ь": "", "э": "e", "ю": "yu", "я": "ya",
       "ў": "o", "қ": "q", "ғ": "g", "ҳ": "h", "ә": "a", "ө": "o", "ү": "u", "ң": "n"}


def to_latin(text: str) -> str:
    return "".join(CYR.get(ch, ch) for ch in text.lower())


class StaffImportError(Exception):
    pass


@dataclass
class Account:
    full_name: str
    email: str
    role: str
    department: str
    password: str


@dataclass
class StaffReport:
    rows: int = 0
    departments: dict[str, dict[str, object]] = field(default_factory=dict)  # отдел → {count, role}
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    skipped: int = 0
    warnings: list[str] = field(default_factory=list)
    accounts: list[Account] = field(default_factory=list)  # новые учётные записи с временными паролями
    dry_run: bool = True


def _norm(v: object) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()


def login_from_latin(latin: str) -> str:
    parts = [re.sub(r"[^a-z0-9]", "", to_latin(p.translate(TRANSLIT))) for p in latin.split()]
    parts = [p for p in parts if p]
    return ".".join(parts[:2]) or "user"


def parse_staff(data: bytes) -> tuple[list[dict[str, str]], list[str]]:
    try:
        wb = openpyxl.load_workbook(BytesIO(data), read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001
        raise StaffImportError(f"Не удалось прочитать Excel: {type(e).__name__}") from None
    sheets = sorted(wb.worksheets, key=lambda ws: ws.title.strip().lower() not in ("сотрудники", "staff"))
    for ws in sheets:
        rows = ws.iter_rows(values_only=True)
        for header in rows:
            names = [_norm(h).lower() for h in header]
            cols = {k: names.index(a) for k, al in ALIASES.items() for a in al if a in names}
            if {"id", "name", "dept"} <= cols.keys():
                out, warnings, seen = [], [], set()
                for n, row in enumerate(rows, start=2):
                    cells = list(row) + [None] * 10
                    pid, name, dept = _norm(cells[cols["id"]]), _norm(cells[cols["name"]]), _norm(cells[cols["dept"]])
                    latin = _norm(cells[cols["latin"]]) if "latin" in cols else ""
                    if pid.endswith(".0"):
                        pid = pid[:-2]
                    if not (pid or name):
                        continue
                    if not pid or not name:
                        warnings.append(f"Строка {n}: нет ID или ФИО — пропущена")
                        continue
                    if pid in seen:
                        warnings.append(f"Строка {n}: ID {pid} повторяется — пропущена")
                        continue
                    seen.add(pid)
                    if not latin:
                        warnings.append(f"Строка {n}: нет ФИО латиницей — логин составлен из русского ФИО (ID {pid})")
                    out.append({"id": pid, "name": name, "latin": latin, "dept": dept or "Без отдела"})
                return out, warnings
            break  # заголовок только в первой непустой строке листа
    raise StaffImportError("Не найден лист со столбцами «ID», «ФИО», «Отдел»")


async def import_staff(session: AsyncSession, data: bytes, *, domain: str, mapping: dict[str, str] | None,
                       dry_run: bool) -> StaffReport:
    domain = domain.strip().lstrip("@").lower()
    if not re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", domain):
        raise StaffImportError("Укажите домен почты, например oxford.uz")
    rows, warnings = parse_staff(data)
    rep = StaffReport(rows=len(rows), warnings=warnings, dry_run=dry_run)
    m = {**DEFAULT_MAPPING, **{k.strip().lower(): v for k, v in (mapping or {}).items()}}
    for r in rows:
        key = r["dept"].lower()
        role = m.get(key, UserRole.STAFF.value)
        if role != SKIP and role not in {x.value for x in UserRole}:
            raise StaffImportError(f"Неизвестная роль «{role}» для отдела «{r['dept']}»")
        d = rep.departments.setdefault(r["dept"], {"count": 0, "role": role})
        d["count"] = int(d["count"]) + 1  # type: ignore[call-overload]

    users = list((await session.execute(select(User))).scalars())
    by_hik = {u.hik_person_id: u for u in users if u.hik_person_id}
    emails = {u.email for u in users}
    for r in rows:
        role = m.get(r["dept"].lower(), UserRole.STAFF.value)
        u = by_hik.get(r["id"])
        if u is not None:  # уже загружен: обновляем ФИО и отдел, роль/почту/пароль не трогаем
            if u.full_name != r["name"] or u.department != r["dept"]:
                rep.updated += 1
                if not dry_run:
                    u.full_name, u.department = r["name"], r["dept"]
            else:
                rep.unchanged += 1
            continue
        if role == SKIP:
            rep.skipped += 1
            continue
        base = login_from_latin(r["latin"] or r["name"])
        if base == "user":  # латиница пустая или нераспознанная — берём русское ФИО
            base = login_from_latin(r["name"])
        email, n = f"{base}@{domain}", 2
        while email in emails:
            email, n = f"{base}{n}@{domain}", n + 1
        emails.add(email)
        rep.created += 1
        password = secrets.token_urlsafe(6)
        if not dry_run:
            hashed = await asyncio.to_thread(hash_password, password)  # bcrypt не блокирует сервер
            session.add(User(email=email, full_name=r["name"], role=UserRole(role), is_active=True,
                             hashed_password=hashed, hik_person_id=r["id"], department=r["dept"]))
            rep.accounts.append(Account(r["name"], email, role, r["dept"], password))
    if not dry_run:
        await session.flush()
    return rep
