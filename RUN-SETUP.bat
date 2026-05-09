@echo off
REM Taha Media OS - one-click setup launcher
REM This bypasses the PowerShell execution policy and triggers the UAC admin prompt.
echo Launching Taha Media OS setup (you will see a UAC prompt - click Yes)...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-taha-os.ps1"
pause
