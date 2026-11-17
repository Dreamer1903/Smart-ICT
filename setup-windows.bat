@echo off
rem SchoolOS: первая установка (один раз). Нужны Python 3.12, Node.js, Git.
cd /d "%~dp0backend"
if not exist ".venv\Scripts\activate.bat" (
  py -3.12 -m venv .venv || (echo Не найден Python 3.12. Установите его с python.org & pause & exit /b 1)
)
call .venv\Scripts\activate.bat
pip install -r requirements.txt || (echo Ошибка pip install & pause & exit /b 1)
cd ..\frontend
call npm install || (echo Ошибка npm install & pause & exit /b 1)
echo.
echo Установка завершена. Загрузите учеников (import_students.py) или демо (seed.py), затем start-windows.bat
pause
