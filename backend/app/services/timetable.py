"""Помощник составления расписания (завуч по учебной части).

Математический решатель OR-Tools CP-SAT. Жёсткие правила соблюдаются всегда:
  * у учителя, у класса и в спецкабинете (биология, информатика, физика) — не больше одного урока одновременно;
  * пожелание учителя «не могу» (совместитель не приходит во вторник и четверг) — урок не ставится;
  * часы нагрузки выполняются полностью; один предмет в классе — не больше 2 уроков в день;
  * закреплённые завучем уроки не двигаются.
Мягкие правила (штрафы, решатель минимизирует сумму):
  * окна у класса и уроки не с первого (вес 100); «нежелательно» у учителя, напр. первые уроки (вес 10);
  * два одинаковых урока в день (вес 5); неровная нагрузка класса по дням (вес 3); окна у учителя (вес 2).
Если расписание невозможно — объясняем почему (diagnose).
"""

import time as _time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from ortools.sat.python import cp_model

DAY_NAMES = {1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб"}

W_CLASS_GAP, W_AVOID, W_DOUBLE, W_BALANCE, W_TEACHER_WINDOW = 100, 10, 5, 3, 2


@dataclass(frozen=True)
class Load:
    """Единица нагрузки: предмет в классе у учителя, N часов в неделю."""

    id: int
    class_id: int
    subject_id: int
    teacher_id: int
    hours: int
    room_id: int | None = None  # спецкабинет предмета


@dataclass
class Problem:
    days: list[int]
    slots: list[int]
    loads: list[Load]
    no_cells: dict[int, set[tuple[int, int]]] = field(default_factory=dict)  # учитель → {(день, урок)} «не могу»
    avoid_cells: dict[int, set[tuple[int, int]]] = field(default_factory=dict)  # «нежелательно»
    max_per_day: dict[int, int] = field(default_factory=dict)  # учитель → максимум уроков в день
    locked: list[tuple[int, int, int]] = field(default_factory=list)  # (load_id, день, урок)
    names: dict[str, dict[int, str]] = field(default_factory=dict)  # для понятных сообщений


@dataclass
class Placement:
    load_id: int
    day: int
    slot: int


@dataclass
class SolveResult:
    ok: bool
    placements: list[Placement]
    problems: list[str]  # почему невозможно
    seconds: float
    status: str


def _n(p: Problem, kind: str, i: int | None) -> str:
    return p.names.get(kind, {}).get(i or 0, f"#{i}")


def diagnose(p: Problem) -> list[str]:
    """Быстрые проверки: что делает задачу невыполнимой."""
    cells = len(p.days) * len(p.slots)
    out: list[str] = []
    by_class, by_teacher, by_room = defaultdict(int), defaultdict(int), defaultdict(int)
    for ld in p.loads:
        by_class[ld.class_id] += ld.hours
        by_teacher[ld.teacher_id] += ld.hours
        if ld.room_id:
            by_room[ld.room_id] += ld.hours
        if ld.hours > 2 * len(p.days):
            out.append(f"{_n(p, 'subject', ld.subject_id)} в {_n(p, 'class', ld.class_id)}: {ld.hours} ч в неделю, "
                       f"а больше 2 уроков в день нельзя ({2 * len(p.days)} максимум)")
    for c, h in by_class.items():
        if h > cells:
            out.append(f"Класс {_n(p, 'class', c)}: {h} ч в неделю, а в сетке только {cells} уроков")
    for t, h in by_teacher.items():
        free = cells - len(p.no_cells.get(t, set()))
        if h > free:
            out.append(f"{_n(p, 'teacher', t)}: {h} ч нагрузки, а свободных по пожеланиям уроков только {free}")
        if t in p.max_per_day:
            days_free = sum(1 for d in p.days if any((d, s) not in p.no_cells.get(t, set()) for s in p.slots))
            if h > p.max_per_day[t] * days_free:
                out.append(f"{_n(p, 'teacher', t)}: {h} ч не помещаются при максимуме {p.max_per_day[t]} уроков в день "
                           f"и {days_free} рабочих днях")
    for r, h in by_room.items():
        if h > cells:
            out.append(f"Кабинет {_n(p, 'room', r)}: {h} ч в неделю, а в сетке только {cells} уроков — "
                       "нужен второй кабинет или меньше часов")
    return out


def solve(p: Problem, time_limit: float = 20.0, workers: int = 8) -> SolveResult:
    started = _time.perf_counter()
    pre = diagnose(p)
    if pre:
        return SolveResult(False, [], pre, 0.0, "INFEASIBLE")

    m = cp_model.CpModel()
    x: dict[tuple[int, int, int], cp_model.IntVar] = {}
    loads = {ld.id: ld for ld in p.loads}
    for ld in p.loads:
        for d in p.days:
            for s in p.slots:
                if (d, s) not in p.no_cells.get(ld.teacher_id, set()):
                    x[ld.id, d, s] = m.new_bool_var(f"x{ld.id}_{d}_{s}")

    for lid, d, s in p.locked:
        if (lid, d, s) not in x:
            ld = loads[lid]
            return SolveResult(False, [], [f"Закреплённый урок {_n(p, 'subject', ld.subject_id)} "
                                           f"({_n(p, 'class', ld.class_id)}) стоит в {DAY_NAMES.get(d, d)} {s}-м уроке, "
                                           f"а учитель {_n(p, 'teacher', ld.teacher_id)} в это время не может"], 0.0, "INFEASIBLE")
        m.add(x[lid, d, s] == 1)

    def xs(pred) -> list:  # noqa: ANN001
        return [v for (lid, d, s), v in x.items() if pred(loads[lid], d, s)]

    penalties: list[Any] = []
    # Часы нагрузки
    for ld in p.loads:
        m.add(sum(x[ld.id, d, s] for d in p.days for s in p.slots if (ld.id, d, s) in x) == ld.hours)
    by_class = defaultdict(list)
    by_teacher = defaultdict(list)
    by_room = defaultdict(list)
    for ld in p.loads:
        by_class[ld.class_id].append(ld)
        by_teacher[ld.teacher_id].append(ld)
        if ld.room_id:
            by_room[ld.room_id].append(ld)

    # Класс: не больше 1 урока в слот, окна и неровная нагрузка — штраф
    for c, cl in by_class.items():
        loads_per_day = []
        for d in p.days:
            occ = {}
            for s in p.slots:
                vs = [x[ld.id, d, s] for ld in cl if (ld.id, d, s) in x]
                m.add(sum(vs) <= 1)
                o = m.new_bool_var(f"occ{c}_{d}_{s}")
                m.add(o == sum(vs))
                occ[s] = o
            for a, b in zip(p.slots, p.slots[1:]):
                gap = m.new_bool_var(f"gap{c}_{d}_{b}")
                m.add(gap >= occ[b] - occ[a])  # урок после пустого слота (в т.ч. не с первого урока)
                penalties.append(W_CLASS_GAP * gap)
            day_load = m.new_int_var(0, len(p.slots), f"load{c}_{d}")
            m.add(day_load == sum(occ.values()))
            loads_per_day.append(day_load)
            # Один предмет — не больше 2 в день, два — штраф
            for ld in cl:
                cnt = sum(x[ld.id, d, s] for s in p.slots if (ld.id, d, s) in x)
                m.add(cnt <= 2)
                dbl = m.new_bool_var(f"dbl{ld.id}_{d}")
                m.add(cnt - 1 <= dbl)
                penalties.append(W_DOUBLE * dbl)
        hi = m.new_int_var(0, len(p.slots), f"hi{c}")
        lo = m.new_int_var(0, len(p.slots), f"lo{c}")
        m.add_max_equality(hi, loads_per_day)
        m.add_min_equality(lo, loads_per_day)
        penalties.append(W_BALANCE * (hi - lo))

    # Учитель: 1 урок в слот, максимум в день, «нежелательно», окна
    for t, tl in by_teacher.items():
        avoid = p.avoid_cells.get(t, set())
        for d in p.days:
            busy = {}
            for s in p.slots:
                vs = [x[ld.id, d, s] for ld in tl if (ld.id, d, s) in x]
                m.add(sum(vs) <= 1)
                b = m.new_bool_var(f"busy{t}_{d}_{s}")
                m.add(b == sum(vs))
                busy[s] = b
                if (d, s) in avoid:
                    penalties.append(W_AVOID * b)
            if t in p.max_per_day:
                m.add(sum(busy.values()) <= p.max_per_day[t])
            for a, b_, c_ in zip(p.slots, p.slots[1:], p.slots[2:]):
                w = m.new_bool_var(f"win{t}_{d}_{b_}")
                m.add(w >= busy[a] + busy[c_] - busy[b_] - 1)
                penalties.append(W_TEACHER_WINDOW * w)

    # Спецкабинет: один урок в слот
    for r, rl in by_room.items():
        for d in p.days:
            for s in p.slots:
                vs = [x[ld.id, d, s] for ld in rl if (ld.id, d, s) in x]
                if len(vs) > 1:
                    m.add(sum(vs) <= 1)

    m.minimize(sum(penalties))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = workers
    solver.parameters.random_seed = 42
    status = solver.solve(m)
    seconds = round(_time.perf_counter() - started, 2)
    name = solver.status_name(status)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        why = ["Решатель не нашёл расписание, удовлетворяющее всем жёстким правилам. Проверьте пожелания «не могу» "
               "у учителей с большой нагрузкой, закреплённые уроки и часы в спецкабинетах."] if status == cp_model.INFEASIBLE \
            else [f"Не успели найти расписание за {time_limit:.0f} с — запустите ещё раз с большим временем"]
        return SolveResult(False, [], why, seconds, name)
    placements = [Placement(lid, d, s) for (lid, d, s), v in x.items() if solver.value(v)]
    return SolveResult(True, placements, [], seconds, name)


# ---------------------------------------------------------------- Анализ готового расписания (отчёт)

@dataclass
class Cell:
    class_id: int
    subject_id: int
    teacher_id: int
    room_id: int | None
    day: int
    slot: int


def analyze(cells: list[Cell], p: Problem) -> dict[str, Any]:
    """Отчёт для завуча и директора: конфликты (должно быть 0), нарушения пожеланий, окна, нагрузка."""
    conflicts: list[str] = []
    seen_class, seen_teacher, seen_room = {}, {}, {}
    for c in cells:
        k = (c.day, c.slot)
        when = f"{DAY_NAMES.get(c.day, c.day)}, {c.slot}-й урок"
        if (c.class_id, *k) in seen_class:
            conflicts.append(f"{_n(p, 'class', c.class_id)}: два урока одновременно ({when})")
        if (c.teacher_id, *k) in seen_teacher:
            conflicts.append(f"{_n(p, 'teacher', c.teacher_id)}: два урока одновременно ({when})")
        if c.room_id and (c.room_id, *k) in seen_room:
            conflicts.append(f"Кабинет {_n(p, 'room', c.room_id)}: два урока одновременно ({when})")
        if k in p.no_cells.get(c.teacher_id, set()):
            conflicts.append(f"{_n(p, 'teacher', c.teacher_id)} не может в {when}, но урок стоит")
        seen_class[(c.class_id, *k)] = seen_teacher[(c.teacher_id, *k)] = 1
        if c.room_id:
            seen_room[(c.room_id, *k)] = 1

    wishes: list[str] = []
    for c in cells:
        if (c.day, c.slot) in p.avoid_cells.get(c.teacher_id, set()):
            wishes.append(f"{_n(p, 'teacher', c.teacher_id)}: {DAY_NAMES.get(c.day)} {c.slot}-й урок "
                          f"({_n(p, 'subject', c.subject_id)}, {_n(p, 'class', c.class_id)}) — просил(а) не ставить")

    class_gaps, teacher_windows = [], {}
    by_cd, by_td = defaultdict(set), defaultdict(set)
    for c in cells:
        by_cd[c.class_id, c.day].add(c.slot)
        by_td[c.teacher_id, c.day].add(c.slot)
    for (cls, d), ss in sorted(by_cd.items()):
        expected = set(range(min(p.slots), min(p.slots) + len(ss)))
        if ss != expected:
            class_gaps.append(f"{_n(p, 'class', cls)}, {DAY_NAMES.get(d)}: уроки {sorted(ss)} — есть окно или не с первого")
    for (t, d), ss in by_td.items():
        w = (max(ss) - min(ss) + 1) - len(ss)
        if w:
            teacher_windows[t] = teacher_windows.get(t, 0) + w

    teacher_load: dict[int, int] = defaultdict(int)
    for c in cells:
        teacher_load[c.teacher_id] += 1
    class_days = {
        _n(p, "class", cls): {DAY_NAMES.get(d, str(d)): len(by_cd.get((cls, d), set())) for d in p.days}
        for cls in sorted({c.class_id for c in cells})
    }
    planned = sum(ld.hours for ld in p.loads)
    return {
        "lessons_placed": len(cells),
        "lessons_planned": planned,
        "conflicts": conflicts,
        "wishes_violated": wishes,
        "class_gaps": class_gaps,
        "teacher_windows": {_n(p, "teacher", t): w for t, w in sorted(teacher_windows.items(), key=lambda kv: -kv[1])},
        "teacher_load": {_n(p, "teacher", t): h for t, h in sorted(teacher_load.items(), key=lambda kv: -kv[1])},
        "class_days": class_days,
        "ok": not conflicts and len(cells) == planned,
    }
