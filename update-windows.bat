@echo off
rem SchoolOS: скачать последнюю версию и обновить библиотеки. Перед этим закройте окна программы.
cd /d "%~dp0"
git pull || (echo Ошибка git pull & pause & exit /b 1)
cd backend
call .venv\Scripts\activate.bat || (echo Нет backend\.venv - запустите setup-windows.bat & pause & exit /b 1)
pip install -r requirements.txt || (echo Ошибка pip install & pause & exit /b 1)
python upgrade_db.py || (echo Ошибка обновления базы & pause & exit /b 1)
cd ..\frontend
call npm install || (echo Ошибка npm install & pause & exit /b 1)
echo.
echo Готово. Теперь запустите start-windows.bat
pause
