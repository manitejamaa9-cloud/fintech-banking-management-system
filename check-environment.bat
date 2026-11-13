@echo off
title FinTech Bank environment check
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-environment.ps1"
echo.
pause
