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

---

# Интеграция: турникеты + 1С + Robi + уведомления

## Схема

```
Ученик → Турникет → Контроллер доступа ──(REST / WebSocket / TCP)──► SchoolOS
                                                                       │
            ┌────────────── Service Access Control ◄───────────────────┤ 1. кто это? (RFID / QR / биометрия)
            │                      │                                   │ 2. выход → OPEN всегда
            │                      ▼                                   │ 3. временный пропуск → OPEN
            │              Service Payment ──HTTP──► 1С                │ 4. есть долг? (кэш 5 мин, таймаут 1.5 с)
            │                      │                                   │
            ▼                      ▼                                   │
   Команда OPEN / DENY      Журнал access_events ── outbox ──► Robi (посещаемость)
   → контроллер → турникет  Live-статус (Пульс)           └──► Telegram / SMS родителям, администрации
```

SchoolOS **никогда не управляет турникетом напрямую** — только контроллером.

### Модульный монолит вместо микросервисов (осознанное решение)

Сервисы из ТЗ реализованы как модули с чёткими границами в одном процессе:

| Сервис из ТЗ | Модуль |
|---|---|
| Service Access Control | `app/services/access.py`, `app/integrations/controllers.py`, `tcp_listener.py`, `api/v1/access.py` |
| Service Payment (1С) | `app/services/payment.py`, `app/integrations/onec.py` |
| Service Attendance (Robi) | `app/integrations/robi.py` + outbox |
| Service Notification | `app/integrations/notify.py`, `app/services/outbox.py` |
| Service API | FastAPI `/api/v1`, Swagger `/docs` |

Почему: решение на турникете должно укладываться в доли секунды — лишние сетевые переходы между
сервисами добавляют задержку и точки отказа, а для одной школы ещё и требуют отдельной эксплуатации.
Модули общаются через интерфейсы и **transactional outbox**, поэтому любой из них можно вынести
в отдельный процесс (например, outbox-воркер → Celery + Redis) без переписывания бизнес-логики.

## Правила принятия решения

1. Неизвестный идентификатор → **DENY** (`UNKNOWN_CREDENTIAL`), уведомление администрации.
2. **Выход (OUT) разрешается всегда** (`ACCESS_ALWAYS_ALLOW_EXIT=true`) — нельзя «запереть» ребёнка в здании.
3. Активный временный пропуск (директор/завуч) → **OPEN** (`OVERRIDE`).
4. Статус оплаты: кэш `PAYMENT_CACHE_TTL_SECONDS`, иначе запрос в 1С (`ONEC_TIMEOUT_SECONDS`).
   Долг > `PAYMENT_DEBT_THRESHOLD` → **DENY** (`DEBT`), иначе **OPEN**.
5. 1С не отвечает — `PAYMENT_UNAVAILABLE_POLICY`:
   `cache` (по умолчанию: по последнему известному статусу, если его нет — пустить), `allow`, `deny`.
6. На экран турникета сумма долга **не выводится** — только «Обратитесь в администрацию».

### Автоматическое открытие после оплаты

* 1С отправляет вебхук `POST /api/v1/integrations/1c/payment-webhook` (заголовок `X-1C-Secret`).
* Страховка: каждые `PAYMENT_RECHECK_INTERVAL_SECONDS` SchoolOS опрашивает 1С по всем должникам.
* При погашении долга: блокировка снимается, родителю уходит уведомление, и если ученик получил
  отказ не более `REOPEN_AFTER_PAYMENT_WINDOW_MINUTES` назад — **турникет открывается сам**
  (для контроллеров с adapter HTTP / WebSocket / TCP).

## Протоколы контроллеров

| Способ | Как подключить |
|---|---|
| REST | `POST /api/v1/access/events` → решение в ответе (`command: OPEN/DENY`) |
| WebSocket | `ws://…/api/v1/access/ws/{device_code}?key=…` — события и команды в обе стороны |
| TCP/IP | JSON lines на `TCP_LISTENER_PORT` (по умолчанию 9100), см. `app/integrations/tcp_listener.py` |
| HTTP-команды | `AccessDevice.adapter=HTTP`, SchoolOS делает POST на `command_url` |
| SDK производителя, OSDP, Wiegand, БД контроллера | через шлюз-адаптер, который транслирует события в один из протоколов выше |

OSDP и Wiegand — протоколы между считывателем и контроллером; SchoolOS получает уже события контроллера.

Пример (REST):

```bash
curl -X POST localhost:8000/api/v1/access/events -H 'X-Gate-Api-Key: dev-gate-key' \
  -H 'Content-Type: application/json' \
  -d '{"device_code":"main-entrance-1","direction":"IN","credential_kind":"RFID","credential_value":"RFID-0003"}'
# → {"command":"DENY","reason":"DEBT","display_text":"Доступ ограничен. Обратитесь в администрацию", ...}
```

## Контракты внешних систем

* **1С**: `GET {ONEC_BASE_URL}/students/{account}/balance` (Basic Auth) →
  `{"account":"LS-0001","debt":150000,"currency":"UZS","paid_until":"2026-12-01"}`.
  Ученик связан с 1С через `Student.external_1c_id` (лицевой счёт).
* **Robi**: `POST {ROBI_BASE_URL}/attendance/events` (Bearer) — по каждому разрешённому проходу;
  `event_id` — ключ идемпотентности, 409 считается успехом.
* **Telegram**: Bot API `sendMessage` на `Student.parent_telegram_chat_id`; **SMS**: универсальный HTTP-шлюз.
  Какие события уходят в каждый канал — `NOTIFY_TELEGRAM_EVENTS`, `NOTIFY_SMS_EVENTS`.

Все исходящие сообщения пишутся в `outbox_messages` в той же транзакции, что и решение, и доставляются
фоновым воркером с экспоненциальными повторами (до `OUTBOX_MAX_ATTEMPTS`). Падение Robi или Telegram
не влияет на работу турникета.

## Локальный запуск всей цепочки

```bash
cd backend
python seed.py --reset
uvicorn simulators.app:app --port 8010 &      # «внешний мир»: 1С, Robi, контроллер, SMS, Telegram
TCP_LISTENER_ENABLED=true uvicorn app.main:app --port 8000
cd ../frontend && npm run dev                  # «Контроль доступа» → http://localhost:5173/access
```

В seed: 3 должника (LS-0003, LS-0014, LS-0019) получают отказ утром. В панели «Контроль доступа»
кнопка «Оплатить (демо)» проводит оплату в симуляторе 1С → 1С шлёт вебхук → доступ открывается.

## API контура доступа (`/api/v1`)

| Метод | Путь | Кто |
|---|---|---|
| POST | `/access/events` | контроллер (`X-Gate-Api-Key`) или Director/Zavuch/DutyTeacher |
| WS | `/access/ws/{device_code}?key=` | контроллер |
| GET | `/access/events`, `/access/summary`, `/access/debtors`, `/access/devices` | Director, Zavuch |
| POST / DELETE | `/access/overrides`, `/access/overrides/{id}` | Director, Zavuch |
| POST | `/access/students/{id}/payment-check` | Director, Zavuch |
| POST | `/access/devices` | SuperAdmin |
| POST | `/integrations/1c/payment-webhook` | 1С (`X-1C-Secret`) |

## Что нужно от школы для подключения реального оборудования

1. Модель контроллеров турникетов и доступный у них способ интеграции (REST/WS/TCP/SDK).
2. Публикация HTTP-сервиса в 1С по контракту выше (или документация существующего API 1С) и вебхук об оплате.
3. API Robi (адрес, токен, формат событий) — текущий клиент подстраивается под него в `robi.py`.
4. Telegram-бот для родителей (привязка `chat_id`) и договор с SMS-провайдером.
