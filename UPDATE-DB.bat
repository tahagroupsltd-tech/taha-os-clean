@echo off
REM ============================================================
REM  Taha Media OS - Database Update
REM  Run this AFTER pulling new Prisma schema changes.
REM  Applies the new tables (events, notes, transactions) and
REM  re-seeds demo data.
REM ============================================================

echo.
echo === Updating Taha Media OS database ===
echo.

cd /d "%~dp0"

echo [1/3] Generating Prisma client...
call npx prisma generate
if errorlevel 1 goto :error

echo.
echo [2/3] Pushing schema to database...
call npx prisma db push
if errorlevel 1 goto :error

echo.
echo [3/3] Seeding demo data...
call npm run db:seed
if errorlevel 1 goto :error

echo.
echo ============================================================
echo   SUCCESS! Database updated.
echo ============================================================
echo.
echo New pages live at:
echo   http://localhost:3000/calendar
echo   http://localhost:3000/notes
echo   http://localhost:3000/finance
echo.
echo Run  npm run dev  if your dev server isn't already running.
echo.
pause
exit /b 0

:error
echo.
echo ============================================================
echo   FAILED - see error above
echo ============================================================
pause
exit /b 1
