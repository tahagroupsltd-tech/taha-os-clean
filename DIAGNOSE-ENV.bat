@echo off
title Taha Media OS - Env Diagnostic
cd /d "%~dp0"

echo.
echo === Env vars in Vercel (production environment) ===
echo.
call vercel env ls production
echo.
echo === Env vars in Vercel (development environment) ===
echo.
call vercel env ls development
echo.
echo === DATABASE_URL line in local .env.production (if it exists) ===
echo.
if exist .env.production (
    findstr /B "DATABASE_URL" .env.production
) else (
    echo .env.production not found.
)
echo.
echo === DATABASE_URL line in local .env (if it exists) ===
echo.
if exist .env (
    findstr /B "DATABASE_URL" .env
) else (
    echo .env not found.
)
echo.
pause
