@echo off
setlocal
cd /d %~dp0
start "Ulan Alert Python API" cmd /k "cd /d %~dp0backend && python -m venv .venv 2>nul && .venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --reload --port 8000"
start "Ulan Alert Frontend" cmd /k "cd /d %~dp0 && npm install && npm run dev"
