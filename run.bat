@echo off
title GearGuard Predictive Maintenance Server
echo ===================================================
echo   Starting GearGuard Predictive Maintenance Server
echo ===================================================
echo.
echo Opening browser at http://127.0.0.1:8000 ...
start "" http://127.0.0.1:8000
echo.
echo Running backend server on http://127.0.0.1:8000
echo (Keep this window open while using GearGuard)
echo.
py backend\app.py
pause
