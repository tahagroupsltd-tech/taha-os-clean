@echo off
REM Quick redeploy after a fix. Vercel project + env vars are already set up.
title Taha Media OS - Redeploy

cd /d "%~dp0"

echo.
echo === Redeploying to Vercel ===
echo.

call vercel deploy --prod --yes

echo.
pause
