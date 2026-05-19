@echo off
echo.
echo ================================================
echo  Taha Media OS -- Google Calendar Setup
echo ================================================
echo.
cd /d "%~dp0"

echo [1/4] Updating DATABASE_URL in Vercel...
echo postgresql://postgres:QAZqaz%%401725.@db.zmhmxfndzrrdmvvqblkx.supabase.co:5432/postgres | vercel env add DATABASE_URL production --force
echo postgresql://postgres:QAZqaz%%401725.@db.zmhmxfndzrrdmvvqblkx.supabase.co:5432/postgres | vercel env add DATABASE_URL preview --force
echo postgresql://postgres:QAZqaz%%401725.@db.zmhmxfndzrrdmvvqblkx.supabase.co:5432/postgres | vercel env add DATABASE_URL development --force

echo.
echo [2/4] Adding Google Calendar env vars to Vercel...

echo 391821907551-2s89l494a6s7h7vj7c73ls142pvucmb6.apps.googleusercontent.com | vercel env add GOOGLE_CLIENT_ID production --force
echo 391821907551-2s89l494a6s7h7vj7c73ls142pvucmb6.apps.googleusercontent.com | vercel env add GOOGLE_CLIENT_ID preview --force
echo 391821907551-2s89l494a6s7h7vj7c73ls142pvucmb6.apps.googleusercontent.com | vercel env add GOOGLE_CLIENT_ID development --force

echo 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 | vercel env add GOOGLE_CLIENT_SECRET production --force
echo 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 | vercel env add GOOGLE_CLIENT_SECRET preview --force
echo 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 | vercel env add GOOGLE_CLIENT_SECRET development --force

echo https://taha-os-clean.vercel.app/api/auth/google-calendar/callback | vercel env add GOOGLE_REDIRECT_URI production --force
echo https://taha-os-clean.vercel.app/api/auth/google-calendar/callback | vercel env add GOOGLE_REDIRECT_URI preview --force
echo http://localhost:3000/api/auth/google-calendar/callback | vercel env add GOOGLE_REDIRECT_URI development --force

echo.
echo [3/4] Deploying to production...
vercel --prod

echo.
echo ================================================
echo  ALL DONE!
echo  Site is live. Go to Settings in the app
echo  and click "Connect Google Calendar"
echo ================================================
pause
