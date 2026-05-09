@echo off
REM ============================================================
REM  Taha Media OS - One-Click Launcher
REM  Updates DB, starts dev server, opens browser.
REM ============================================================

title Taha Media OS

cd /d "%~dp0"

echo.
echo ====================================================
echo   Taha Media OS - one-click launcher
echo ====================================================
echo.

echo [1/4] Generating Prisma client...
call npx prisma generate
if errorlevel 1 goto :error

echo.
echo [2/4] Pushing schema to database...
call npx prisma db push
if errorlevel 1 goto :error

echo.
echo [3/4] Seeding demo data...
call npm run db:seed
if errorlevel 1 (
  echo Seed failed - continuing anyway. Existing data is intact.
)

echo.
echo [4/4] Starting Next.js dev server...
echo.
echo Opening http://localhost:3000 in 8 seconds...
echo Keep this window open. Press Ctrl+C to stop the server.
echo.

REM Open browser after short delay so server is ready
start "" /b cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:3000"

call npm run dev
exit /b 0

:error
echo.
echo ====================================================
echo   FAILED - see error above
echo ====================================================
pause
exit /b 1
