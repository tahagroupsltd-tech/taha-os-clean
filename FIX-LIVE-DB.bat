@echo off
REM Fixes the production runtime DATABASE_URL so concurrent Prisma queries
REM (the dashboard fires 10 in parallel) don't blow up on Supabase's
REM transaction pooler. Adds ?pgbouncer=true&connection_limit=1.
title Taha Media OS - Fix Live DB URL
setlocal

cd /d "%~dp0"

echo.
echo === Writing pooler-safe DATABASE_URL to a temp file (Node, so special chars survive) ===
echo.
node -e "require('fs').writeFileSync('db_url.tmp','postgresql://postgres.zmhmxfndzrrdmvvqblkx:AEnQ0lqaIFCLei2v@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1')"
if errorlevel 1 goto :error

echo === Removing old DATABASE_URL on Vercel ===
echo.
call vercel env rm DATABASE_URL production --yes
echo (errors above are fine if it didn't exist)

echo.
echo === Adding new DATABASE_URL on Vercel ===
echo.
call vercel env add DATABASE_URL production < db_url.tmp
if errorlevel 1 goto :error

del db_url.tmp >nul 2>nul

echo.
echo === Redeploying to production ===
echo.
call vercel deploy --prod --yes
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  DONE. Wait ~15 seconds, then refresh:
echo  https://taha-os-clean.vercel.app
echo  Login as admin / admin123
echo ============================================================
echo.
pause
exit /b 0

:error
if exist db_url.tmp del db_url.tmp
echo.
echo Something went wrong. Copy the last 15 lines and send to me.
pause
exit /b 1
