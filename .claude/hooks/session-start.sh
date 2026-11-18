#!/bin/bash
# SchoolOS: подготовка облачной сессии Claude Code — библиотеки, демо-база и запуск предпросмотра
# (сайт :5173, сервер :8000, симулятор 1С/HikCentral :8010).
set -euo pipefail

# Только в облачной среде Claude Code (на своём компьютере используйте start-windows.bat)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
ROOT="$(pwd)"
LOGS=/tmp/schoolos
mkdir -p "$LOGS"

# ---------- Backend: Python-окружение backend/.venv (git его игнорирует)
if [ ! -x backend/.venv/bin/python ]; then
  python3 -m venv backend/.venv
fi
pyhashes=backend/.venv/.session-start.sha256
if ! sha256sum --check --status "$pyhashes" 2>/dev/null; then
  rm -f "$pyhashes"
  backend/.venv/bin/python -m pip install --quiet --upgrade pip
  backend/.venv/bin/python -m pip install --quiet -r backend/requirements.txt
  sha256sum .claude/hooks/session-start.sh backend/requirements.txt > "$pyhashes" || rm -f "$pyhashes"
fi

# ---------- Frontend: npm в frontend/node_modules (git его игнорирует)
nodehashes=frontend/node_modules/.session-start.sha256
if ! sha256sum --check --status "$nodehashes" 2>/dev/null; then
  rm -f "$nodehashes"
  (cd frontend && npm install --no-audit --no-fund --loglevel=error)
  sha256sum .claude/hooks/session-start.sh frontend/package.json frontend/package-lock.json > "$nodehashes" || rm -f "$nodehashes"
fi

# ---------- Демо-база: создать (с расписанием и дежурствами) или обновить структуру, не теряя данные
cd backend
if [ -f school_os.db ]; then
  .venv/bin/python upgrade_db.py > "$LOGS/upgrade_db.log" 2>&1
else
  .venv/bin/python seed.py --reset > "$LOGS/seed.log" 2>&1
fi
cd "$ROOT"

# ---------- Запуск в фоне (если ещё не запущено) — для предпросмотра
port_up() { curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$1/"; }
start_bg() {  # отвязываем процесс от хука: перенаправляем ВСЕ потоки фонового процесса, иначе сессия ждёт его
  local dir="$1" log="$2"; shift 2
  (cd "$dir" && exec setsid nohup "$@") > "$LOGS/$log" 2>&1 < /dev/null &
}
port_up 8010 || start_bg backend simulator.log .venv/bin/uvicorn simulators.app:app --port 8010
port_up 8000 || start_bg backend server.log .venv/bin/uvicorn app.main:app --port 8000
port_up 5173 || start_bg frontend site.log npx vite --port 5173 --strictPort

# Ждём готовности (до 60 с), чтобы предпросмотр открылся сразу
for _ in $(seq 1 60); do
  if port_up 8000 && port_up 5173; then break; fi
  sleep 1
done
if port_up 8000 && port_up 5173; then
  echo "SchoolOS запущен: сайт http://localhost:5173 (порт 5173 — для предпросмотра), логи в $LOGS"
else
  echo "SchoolOS: сервер или сайт не запустились, смотрите логи в $LOGS" >&2
fi
