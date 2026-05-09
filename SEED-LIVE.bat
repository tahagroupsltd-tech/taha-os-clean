@echo off
REM Seeds the live Supabase database directly using the known connection string.
REM Local .env (which points at localhost) is left untouched.
title Taha Media OS - Seed Live Database
setlocal

cd /d "%~dp0"

REM Session pooler on port 5432 (NOT transaction pooler 6543) so Prisma works.
set "DATABASE_URL=postgresql://postgres.zmhmxfndzrrdmvvqblkx:AEnQ0lqaIFCLei2v@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

echo.
echo === Seeding live Supabase database ===
echo.
call npx tsx prisma/seed.ts
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  DONE. Try logging in at https://taha-os-clean.vercel.app
echo
echo    admin     / admin123
echo    editor    / editor123
echo    designer  / designer123
echo    axsclient / client123
echo ============================================================
echo.
pause
exit /b 0

:error
echo.
echo Something went wrong. Copy the last 15 lines above and send them to me.
echo.
pause
exit /b 1
