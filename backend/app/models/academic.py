"""Учебный процесс: звонки, периоды, нагрузка, пожелания учителей, расписание,
электронный журнал (уроки, посещаемость, оценки, итоговые оценки) и библиотека материалов."""

import datetime as dt
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, str_enum, utcnow
from app.models.enums import (
    AttendanceMark,
    GradeKind,
    MaterialKind,
    PeriodCode,
    ProposalStatus,
    TimetableStatus,
    Visibility,
)

if TYPE_CHECKING:
    from app.models.school import ClassRoom, SchoolClass, Subject
    from app.models.student import Student
    from app.models.user import User


class BellSlot(Base):
    """Расписание звонков: урок № N с … по …"""

    __tablename__ = "bell_slots"

    number: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time] = mapped_column(Time)


class AcademicPeriod(Base):
    """Четверть / полугодие / год — границы дат для расчёта средних и итоговых оценок."""

    __tablename__ = "academic_periods"
    __table_args__ = (UniqueConstraint("school_year", "code", name="uq_academic_periods_year_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_year: Mapped[str] = mapped_column(String(9))  # «2026-2027»
    code: Mapped[PeriodCode] = mapped_column(str_enum(PeriodCode, "period_code"))
    name: Mapped[str] = mapped_column(String(64))
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date] = mapped_column(Date)


class TeachingAssignment(Base):
    """Нагрузка: кто ведёт предмет в классе и сколько часов в неделю."""

    __tablename__ = "teaching_assignments"
    __table_args__ = (UniqueConstraint("class_id", "subject_id", name="uq_teaching_assignments_class_subject"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    hours_per_week: Mapped[int] = mapped_column(Integer)

    school_class: Mapped["SchoolClass"] = relationship()
    subject: Mapped["Subject"] = relationship()
    teacher: Mapped["User"] = relationship()


class TeacherPreference(Base):
    """Пожелания учителя к расписанию.

    cells: {"<день>-<урок>": "no" | "avoid"} — «no»: не может (совместитель, другой работы),
    «avoid»: нежелательно (например, не любит первые уроки). День 1 = понедельник.
    """

    __tablename__ = "teacher_preferences"

    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    cells: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    max_lessons_per_day: Mapped[int | None] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class TimetableVersion(Base):
    """Вариант расписания: черновик → опубликован (действует) → в архиве."""

    __tablename__ = "timetable_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    status: Mapped[TimetableStatus] = mapped_column(str_enum(TimetableStatus, "timetable_status"), default=TimetableStatus.DRAFT, index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    published_at: Mapped[dt.datetime | None] = mapped_column(UTCDateTime)
    report: Mapped[dict[str, Any] | None] = mapped_column(JSON)  # отчёт помощника: нарушения, статистика

    entries: Mapped[list["TimetableEntry"]] = relationship(back_populates="version", cascade="all, delete-orphan")


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"
    __table_args__ = (
        UniqueConstraint("version_id", "class_id", "day", "slot", name="uq_timetable_class_slot"),
        UniqueConstraint("version_id", "teacher_id", "day", "slot", name="uq_timetable_teacher_slot"),
        Index("ix_timetable_room_slot", "version_id", "room_id", "day", "slot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("timetable_versions.id", ondelete="CASCADE"), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    room_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id", ondelete="SET NULL"))
    day: Mapped[int] = mapped_column(Integer)  # 1 = понедельник
    slot: Mapped[int] = mapped_column(Integer)  # номер урока
    locked: Mapped[bool] = mapped_column(Boolean, default=False)  # закреплён завучем: помощник не двигает

    version: Mapped[TimetableVersion] = relationship(back_populates="entries")
    school_class: Mapped["SchoolClass"] = relationship()
    subject: Mapped["Subject"] = relationship()
    teacher: Mapped["User"] = relationship()
    room: Mapped["ClassRoom | None"] = relationship()


class TimetableProposal(Base):
    """Предложение учителя: перенести свой урок в другое время."""

    __tablename__ = "timetable_proposals"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("timetable_entries.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    to_day: Mapped[int] = mapped_column(Integer)
    to_slot: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ProposalStatus] = mapped_column(str_enum(ProposalStatus, "proposal_status"), default=ProposalStatus.PENDING)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolution_comment: Mapped[str | None] = mapped_column(Text)

    entry: Mapped[TimetableEntry] = relationship()


# ---------------------------------------------------------------- Электронный журнал

class Lesson(Base):
    """Проведённый (или запланированный) урок в журнале: тема и домашнее задание."""

    __tablename__ = "lessons"
    __table_args__ = (UniqueConstraint("class_id", "date", "slot", name="uq_lessons_class_date_slot"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    slot: Mapped[int] = mapped_column(Integer)
    topic: Mapped[str | None] = mapped_column(String(255))
    homework: Mapped[str | None] = mapped_column(Text)
    homework_due: Mapped[dt.date | None] = mapped_column(Date)
    updated_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    subject: Mapped["Subject"] = relationship()
    teacher: Mapped["User"] = relationship()
    school_class: Mapped["SchoolClass"] = relationship()


class LessonAttendance(Base):
    __tablename__ = "lesson_attendance"
    __table_args__ = (UniqueConstraint("lesson_id", "student_id", name="uq_lesson_attendance_lesson_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    mark: Mapped[AttendanceMark] = mapped_column(str_enum(AttendanceMark, "attendance_mark"))
    late_minutes: Mapped[int | None] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(String(255))
    marked_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    marked_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    lesson: Mapped[Lesson] = relationship()


class Grade(Base):
    """Текущая оценка с комментарием."""

    __tablename__ = "grades"
    __table_args__ = (Index("ix_grades_student_subject_date", "student_id", "subject_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"))
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    date: Mapped[dt.date] = mapped_column(Date)
    value: Mapped[int] = mapped_column(Integer)
    kind: Mapped[GradeKind] = mapped_column(str_enum(GradeKind, "grade_kind"), default=GradeKind.CLASSWORK)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    subject: Mapped["Subject"] = relationship()
    teacher: Mapped["User | None"] = relationship()


class PeriodGrade(Base):
    """Оценка за четверть / полугодие / год / итоговая аттестация."""

    __tablename__ = "period_grades"
    __table_args__ = (UniqueConstraint("student_id", "subject_id", "school_year", "period",
                                       name="uq_period_grades_student_subject_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    school_year: Mapped[str] = mapped_column(String(9))
    period: Mapped[PeriodCode] = mapped_column(str_enum(PeriodCode, "period_grade_code"))
    value: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    updated_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    subject: Mapped["Subject"] = relationship()


# ---------------------------------------------------------------- Библиотека

class Material(Base):
    """Учебный материал: поурочный план, план-конспект, книга, карточки, презентация."""

    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    kind: Mapped[MaterialKind] = mapped_column(str_enum(MaterialKind, "material_kind"))
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"))
    grade_level: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    file_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(64), unique=True)  # имя файла на диске (uuid)
    content_type: Mapped[str | None] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(Integer)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    visibility: Mapped[Visibility] = mapped_column(str_enum(Visibility, "material_visibility"), default=Visibility.PRIVATE, index=True)
    downloads: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    published_at: Mapped[dt.datetime | None] = mapped_column(UTCDateTime)

    subject: Mapped["Subject | None"] = relationship()
    author: Mapped["User | None"] = relationship()
