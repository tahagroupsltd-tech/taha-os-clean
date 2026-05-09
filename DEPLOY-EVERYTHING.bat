@echo off
REM One-click deploy: fixes the production DATABASE_URL, pushes the latest
REM schema (incl. DailyReport) to Supabase via the session pooler, and
REM redeploys to Vercel. Local .env stays pointing at localhost.
title Taha Media OS - Deploy Everything
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "POOLED_URL=postgresql://postgres.zmhmxfndzrrdmvvqblkx:AEnQ0lqaIFCLei2v@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
set "SESSION_URL=postgresql://postgres.zmhmxfndzrrdmvvqblkx:AEnQ0lqaIFCLei2v@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

echo.
echo ============================================================
echo   STEP 1/3   Push latest schema to Supabase
echo ============================================================
echo.
set "DATABASE_URL=%SESSION_URL%"
call npx prisma db push --skip-generate --accept-data-loss
if errorlevel 1 goto :error

echo.
echo ============================================================
echo   STEP 2/3   Update Vercel DATABASE_URL with pgbouncer flag
echo ============================================================
echo.
node -e "require('fs').writeFileSync('db_url.tmp','postgresql://postgres.zmhmxfndzrrdmvvqblkx:AEnQ0lqaIFCLei2v@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1')"
if errorlevel 1 goto :error

call vercel env rm DATABASE_URL production --yes
echo (errors above are fine)
echo.
call vercel env add DATABASE_URL production < db_url.tmp
if errorlevel 1 (
    del db_url.tmp >nul 2>nul
    goto :error
)
del db_url.tmp >nul 2>nul

echo.
echo ============================================================
echo   STEP 3/3   Redeploy to production
echo ============================================================
echo.
call vercel deploy --prod --yes
if errorlevel 1 goto :error

echo.
echo ============================================================
echo   DONE
echo
echo   Wait ~30 seconds for the new deploy to go live, then:
echo   https://taha-os-clean.vercel.app
echo
echo   Login: admin / admin123
echo
echo   New features to try:
echo   - Founder dashboard (more cards, weekly events, top earners)
echo   - Client Billing page (per-client payment tracking)
echo   - Daily Reports (submit + see team status)
echo   - Settings -> change your own password OR reset another user's
echo ============================================================
echo.
pause
exit /b 0

:error
if exist db_url.tmp del db_url.tmp
echo.
echo Something went wrong. Copy the last 20 lines and send to me.
pause
exit /b 1
