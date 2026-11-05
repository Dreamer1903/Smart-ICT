"""Декларативная база SQLAlchemy 2.0 и общие типы колонок."""

import enum
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, Enum, MetaData, TypeDecorator
from sqlalchemy.orm import DeclarativeBase

# Детерминированные имена ограничений — важно для Alembic (особенно batch-режима SQLite)
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UTCDateTime(TypeDecorator[datetime]):
    """Всегда хранит и возвращает timezone-aware UTC.

    SQLite не хранит смещение, поэтому при чтении принудительно ставим tzinfo=UTC.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


def utcnow() -> datetime:
    return datetime.now(UTC)


def str_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Enum-колонка, хранящая значения (а не имена) как VARCHAR + CHECK — переносимо между SQLite и PG."""
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        length=32,
        validate_strings=True,
        values_callable=lambda e: [m.value for m in e],
    )
