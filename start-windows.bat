@echo off
rem SchoolOS: запуск всех трёх частей одним двойным щелчком.
rem Открывает 3 окна (симулятор, сервер, сайт) и браузер. Окна не закрывать.
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\activate.bat" (
  echo Нет папки backend\.venv - сначала выполните установку (setup-windows.bat^).
  pause
  exit /b 1
)

echo Проверяю базу данных...
pushd backend
call .venv\Scripts\activate.bat
python upgrade_db.py || (echo Ошибка обновления базы - пришлите снимок этого окна & pause & exit /b 1)
popd

start "SchoolOS 1 - simulator" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && uvicorn simulators.app:app --port 8010"
start "SchoolOS 2 - server" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && uvicorn app.main:app --port 8000"
start "SchoolOS 3 - site" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Запускаю... через 10 секунд откроется браузер.
timeout /t 10 /nobreak >nul
start "" http://localhost:5173
