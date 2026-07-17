@echo off
REM Classwork Studio - convenience launcher for Windows.
REM For real deployments use run.bat (Waitress via waitress-serve) and
REM a process supervisor (nssm / Task Scheduler).

cd /d "%~dp0"

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Idempotent install (pip skips up-to-date packages).
python -m pip install -q -r requirements.txt
python wsgi.py
pause
