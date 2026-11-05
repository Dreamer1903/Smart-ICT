# School OS — MVP

Модульная система операционного мониторинга школы (event-driven).
Код находится в `backend/` (FastAPI) и `frontend/` (React + Vite) и не зависит от приложения Smart ICT в корне репозитория.

## Быстрый старт

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # по умолчанию SQLite
python seed.py --reset        # схема + тестовые данные
uvicorn app.main:app --reload --port 8000     # Swagger: http://localhost:8000/docs

# Frontend (в другом терминале)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (проксирует /api → :8000)
```

Демо-логины (пароль `school123`): `director@school.uz`, `zavuch@school.uz`, `nurse@school.uz`,
`teacher@school.uz`, `duty@school.uz`, `admin@school.uz`.

**PostgreSQL 16:** `DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/school_os`, затем
`alembic upgrade head && python seed.py`.

**Тесты:** `cd backend && pytest` (SQLite) или
`TEST_DATABASE_URL=postgresql+asyncpg://... pytest`.

## Архитектура

```
Турникет ──POST /gate/pass──┐
Медсестра ─POST/PATCH /nurse/visits─┤      app/services/presence.py       ┌─ GET /dashboard/live-pulse
Учитель ──POST /attendance/class-check─┼──► (state machine StudentPresenceState) ─┤
APScheduler (сверка DISCREPANCY, сброс дня)┘   │ enqueue_event → commit → EventBus └─ SSE /dashboard/stream → UI
```

* **Единая точка изменения статуса** — `app/services/presence.py`. Все переходы порождают доменные события,
  которые публикуются в шину **только после коммита** (`commit_and_dispatch`).
* **Live-обновление UI** — Server-Sent Events (`/api/v1/dashboard/stream?token=…`); фронт по событию
  перезапрашивает сводку (debounce 300 мс) и подсвечивает изменившиеся строки.
* **Фоновые задачи** — APScheduler в процессе API: сверка DISCREPANCY (раз в 60 с) и ежедневный сброс
  статусов. Функции не зависят от планировщика, поэтому переносятся в Celery beat + Redis без изменений
  бизнес-логики (тогда и `EventBus` меняется на Redis Pub/Sub).

### Правила Live-статусов

| Событие | Новый статус |
|---|---|
| Турникет IN | `IN_BUILDING` (если уже `IN_CLASS`/`IN_NURSE` — не меняется) |
| Турникет OUT | `LEFT_SCHOOL`; открытый визит в медпункт закрывается как `SENT_HOME` |
| Медпункт «На осмотре» (`RESTING`) | `IN_NURSE` |
| Медпункт «Вернулся на урок» | `IN_CLASS` |
| Медпункт «Домой» (`SENT_HOME`) | `LEFT_SCHOOL` |
| Перекличка: присутствует / отсутствует | `IN_CLASS` / `IN_BUILDING` |
| `IN_BUILDING` дольше `DISCREPANCY_GRACE_MINUTES` после прохода IN | флаг **DISCREPANCY** |

Устаревшие события турникета (timestamp раньше последнего учтённого) сохраняются в журнал,
но статус не меняют (`applied: false`).

## API (`/api/v1`)

| Метод | Путь | Роли |
|---|---|---|
| POST | `/auth/login` (JSON), `/auth/token` (OAuth2 form) | — |
| GET | `/auth/me` | любой |
| GET | `/students?search=&class_id=`, `/classes`, `/classrooms`, `/subjects` | любой сотрудник |
| GET | `/users` | Director, Zavuch |
| GET | `/nurse/visits?active=` | Nurse, Director, Zavuch |
| POST / PATCH | `/nurse/visits`, `/nurse/visits/{id}` | Nurse |
| POST | `/gate/pass` | заголовок `X-Gate-Api-Key` **или** JWT Director/Zavuch/DutyTeacher |
| GET | `/gate/logs` | Director, Zavuch, DutyTeacher |
| POST | `/attendance/class-check` | Teacher, Zavuch, Director, DutyTeacher |
| GET | `/dashboard/live-pulse`, `/dashboard/stream` (SSE) | Director, Zavuch, DutyTeacher |

SuperAdmin имеет доступ ко всему.

Пример вебхука турникета:

```bash
curl -X POST localhost:8000/api/v1/gate/pass -H 'X-Gate-Api-Key: dev-gate-key' \
  -H 'Content-Type: application/json' -d '{"rfid_card_id":"RFID-0009","direction":"IN"}'
```

## Структура

```
backend/
  app/core/        config, security (JWT/bcrypt), events (EventBus)
  app/db/          Base, UTCDateTime, async engine/session
  app/models/      User, SchoolClass, ClassRoom, Subject, Student, TurnstileLog, NurseVisit, StudentPresenceState
  app/schemas/     Pydantic v2
  app/services/    presence (state machine), dashboard (агрегация), scheduler
  app/api/v1/      auth, catalog, nurse, gate, attendance, dashboard
  alembic/         async-миграции (batch-режим для SQLite)
  seed.py, tests/
frontend/src/
  pages/           LoginPage, NursePage, PulsePage
  components/      Layout, StudentsTable (TanStack), GateSimulator, ui/* (shadcn-style)
  hooks/           useLiveEvents (SSE)
  lib/             api, types, utils
```
