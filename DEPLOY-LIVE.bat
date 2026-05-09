@echo off
setlocal enabledelayedexpansion
title Taha Media OS - Deploy Live

REM ============================================================
REM  Taha Media OS - One-Click Live Deployment
REM  - Installs Vercel CLI if missing
REM  - Logs into Vercel (browser window pops up first time)
REM  - Sets DATABASE_URL + JWT_SECRET in Vercel
REM  - Deploys to production
REM  - Seeds the live Supabase DB with admin user + demo data
REM ============================================================

cd /d "%~dp0"

set "DB_URL=postgresql://postgres.zmhmxfndzrrdmvvqblkx:AEnQ0lqaIFCLei2v@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
set "JWT_SECRET=tahaOS_prod_jwt_zR7vYqK4mNc8hPbLdW3xT6sFgJ9eA2uHnX5kDvQwBmCpYrZjLfNtIsoQUykdAxz"

echo.
echo =====================================================
echo   Taha Media OS - Live Deploy
echo =====================================================
echo.

REM ---------- 1. Vercel CLI ----------
where vercel >nul 2>nul
if errorlevel 1 (
  echo [1/6] Installing Vercel CLI globally...
  call npm install -g vercel
  if errorlevel 1 goto :error
) else (
  echo [1/6] Vercel CLI already installed.
)

REM ---------- 2. Login ----------
echo.
echo [2/6] Checking Vercel login...
call vercel whoami >nul 2>nul
if errorlevel 1 (
  echo Logging into Vercel - a browser window will open.
  call vercel login
  if errorlevel 1 goto :error
) else (
  echo Already logged in.
)

REM ---------- 3. Link the project (creates Vercel project on first run) ----------
echo.
echo [3/6] Linking project to Vercel...
call vercel link --yes
if errorlevel 1 goto :error

REM ---------- 4. Push environment variables ----------
echo.
echo [4/6] Setting environment variables on Vercel...

call vercel env rm DATABASE_URL production --yes >nul 2>nul
echo !DB_URL!| call vercel env add DATABASE_URL production
if errorlevel 1 goto :error

call vercel env rm JWT_SECRET production --yes >nul 2>nul
echo !JWT_SECRET!| call vercel env add JWT_SECRET production
if errorlevel 1 goto :error

REM ---------- 5. Deploy to production ----------
echo.
echo [5/6] Deploying to production. This takes 2-4 minutes...
call vercel deploy --prod --yes
if errorlevel 1 goto :error

REM ---------- 6. Seed the live database ----------
echo.
echo [6/6] Seeding live Supabase database with admin user + demo data...
set "DATABASE_URL=!DB_URL!"
call npm run db:seed
if errorlevel 1 (
  echo Seed failed - you can re-run later. The deploy itself succeeded.
)

echo.
echo =====================================================
echo   DONE! Your app is LIVE.
echo =====================================================
echo.
echo Login credentials (same as local):
echo   Admin:    admin    / admin123
echo   Editor:   editor   / editor123
echo   Designer: designer / designer123
echo   Client:   axsclient / client123
echo.
echo IMPORTANT: change the admin password after first login.
echo.
echo Run  vercel  again later to deploy new changes.
echo.
pause
exit /b 0

:error
echo.
echo =====================================================
echo   Deploy failed - see the error above.
echo =====================================================
pause
exit /b 1
