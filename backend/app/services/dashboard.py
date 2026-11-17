"""Агрегация данных для дашборда «Пульс школы»."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.base import utcnow
from app.models import LocationStatus, NurseVisit, Student, StudentStatus
from app.schemas.dashboard import ClassPulse, LivePulse, PulseCounters, StudentLiveRow

DEFAULT_REASONS: dict[LocationStatus, str] = {
    LocationStatus.IN_CLASS: "На уроке",
    LocationStatus.IN_NURSE: "В медпункте",
    LocationStatus.IN_BOARDING: "В пансионате",
    LocationStatus.IN_BUILDING: "В здании, не дошёл до класса",
    LocationStatus.LEFT_SCHOOL: "Покинул школу",
    LocationStatus.UNKNOWN: "Сегодня не проходил турникет",
}


async def build_live_pulse(session: AsyncSession) -> LivePulse:
    students = (
        await session.execute(
            select(Student)
            .where(Student.status == StudentStatus.ACTIVE)  # идущие на приём пока не считаются
            .options(selectinload(Student.school_class), selectinload(Student.presence))
            .order_by(Student.class_id, Student.full_name)
        )
    ).scalars().all()

    active_visits = {
        v.student_id: v
        for v in (await session.execute(select(NurseVisit).where(NurseVisit.end_time.is_(None)))).scalars()
    }

    counters = PulseCounters()
    per_class: dict[int, ClassPulse] = {}
    rows: list[StudentLiveRow] = []

    for s in students:
        p = s.presence
        status = p.current_location_status if p else LocationStatus.UNKNOWN
        is_disc = bool(p and p.is_discrepancy)

        counters.total_students += 1
        cp = per_class.setdefault(
            s.class_id, ClassPulse(class_id=s.class_id, class_name=s.school_class.name)
        )
        cp.total += 1

        match status:
            case LocationStatus.IN_CLASS:
                counters.in_class += 1
                cp.in_class += 1
            case LocationStatus.IN_NURSE:
                counters.in_nurse += 1
                cp.in_nurse += 1
            case LocationStatus.IN_BOARDING:
                counters.in_boarding += 1
                cp.in_boarding += 1
            case LocationStatus.IN_BUILDING:
                counters.not_reached_class += 1
                cp.not_reached_class += 1
            case LocationStatus.LEFT_SCHOOL:
                counters.left_school += 1
                cp.absent += 1
            case LocationStatus.UNKNOWN:
                counters.not_arrived += 1
                cp.absent += 1
        if is_disc:
            counters.discrepancies += 1

        visit = active_visits.get(s.id)
        reason = (p.note if p and p.note else None) or DEFAULT_REASONS[status]
        if status is LocationStatus.IN_NURSE and visit:
            reason = f"Медпункт: {visit.reason}"

        rows.append(
            StudentLiveRow(
                student_id=s.id,
                full_name=s.full_name,
                class_id=s.class_id,
                class_name=s.school_class.name,
                status=status,
                is_discrepancy=is_disc,
                reason=reason,
                since=p.last_updated if p else None,
                last_gate_direction=p.last_gate_direction if p else None,
                last_gate_at=p.last_gate_at if p else None,
                active_nurse_visit_id=visit.id if visit else None,
                is_boarder=bool(s.is_boarder),
            )
        )

    counters.in_building = counters.in_class + counters.in_nurse + counters.not_reached_class + counters.in_boarding
    return LivePulse(
        generated_at=utcnow(),
        counters=counters,
        classes=sorted(per_class.values(), key=lambda c: c.class_name),
        students=rows,
    )
