# ============================================================
#  Taha Media OS — One-Click Setup
#  Resets the postgres password, creates the taha_os database,
#  updates .env, then runs prisma db push + seed.
#
#  HOW TO RUN:
#    1. Right-click this file
#    2. Choose "Run with PowerShell"
#    3. If Windows asks, click "Yes" to allow admin
# ============================================================

# --- Force admin elevation ---------------------------------
if (-not ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(`
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Relaunching as Administrator..." -ForegroundColor Yellow
    Start-Process powershell.exe "-ExecutionPolicy Bypass -NoExit -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# --- Config ------------------------------------------------
$ProjectDir    = "C:\Users\SEC\Downloads\taha-os-clean\taha-os-clean"
$PgRoot        = "C:\Program Files\PostgreSQL\18"
$PgData        = Join-Path $PgRoot "data"
$PgBin         = Join-Path $PgRoot "bin"
$PsqlExe       = Join-Path $PgBin  "psql.exe"
$HbaConf       = Join-Path $PgData "pg_hba.conf"
$HbaBackup     = Join-Path $PgData "pg_hba.conf.bak-taha"
$ServiceName   = "postgresql-x64-18"
$NewPassword   = "taha2026"   # simple, no special chars -> no URL encoding headaches
$DbName        = "taha_os"
$EnvPath       = Join-Path $ProjectDir ".env"
$EnvLocalPath  = Join-Path $ProjectDir ".env.local"

Set-Location $ProjectDir
$ErrorActionPreference = "Stop"

function Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}
function Good($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Die($msg)  {
    Write-Host ""
    Write-Host "[ERROR] $msg" -ForegroundColor Red
    Write-Host "Press Enter to close..." -ForegroundColor Red
    [void](Read-Host)
    exit 1
}

# --- Sanity checks -----------------------------------------
Step "Checking PostgreSQL installation"
if (-not (Test-Path $PsqlExe)) { Die "psql.exe not found at $PsqlExe" }
if (-not (Test-Path $HbaConf)) { Die "pg_hba.conf not found at $HbaConf" }
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
    Die "Service $ServiceName not found. Is PostgreSQL 18 installed?"
}
Good "PostgreSQL 18 detected."

# --- Helper: can we already connect with $NewPassword? -----
function Test-PostgresPassword {
    param([string]$Password)
    $env:PGPASSWORD = $Password
    & $PsqlExe -U postgres -d postgres -c "SELECT 1;" 2>&1 | Out-Null
    $ok = ($LASTEXITCODE -eq 0)
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    return $ok
}

# --- Helper: does the target database exist? ---------------
function Test-DatabaseExists {
    param([string]$Password, [string]$DbName)
    $env:PGPASSWORD = $Password
    $raw = (& $PsqlExe -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName';" 2>$null) | Out-String
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    return ($raw.Trim() -eq "1")
}

# --- 1. Decide whether we need the trust-mode dance --------
Step "Checking if postgres already accepts '$NewPassword'"
$passwordAlreadyCorrect = Test-PostgresPassword -Password $NewPassword

if ($passwordAlreadyCorrect) {
    Good "Password is already set correctly. Skipping reset."
} else {
    Warn "Password not set or different. Doing a full password reset..."

    # Backup + patch pg_hba.conf
    Step "Switching pg_hba.conf to 'trust' auth (temporary)"
    Copy-Item $HbaConf $HbaBackup -Force
    Good "Backed up -> $HbaBackup"

    $hbaLines = Get-Content $HbaConf
    $patched = foreach ($line in $hbaLines) {
        if ($line -match '^\s*#') { $line; continue }
        if ($line -match '^\s*$') { $line; continue }
        $line -replace '(scram-sha-256|md5|password|ident|peer|sspi|gss|radius|ldap|cert)\s*$', 'trust'
    }
    Set-Content -Path $HbaConf -Value $patched -Encoding ASCII
    Good "pg_hba.conf patched."

    try {
        Step "Restarting $ServiceName"
        Restart-Service $ServiceName -Force
        Start-Sleep -Seconds 3
        Good "Service restarted."

        Step "Resetting postgres password"
        $setPw = "ALTER USER postgres WITH PASSWORD '$NewPassword';"
        $setPw | & $PsqlExe -U postgres -d postgres -v ON_ERROR_STOP=1
        if ($LASTEXITCODE -ne 0) { Die "Failed to set postgres password." }
        Good "Password set to: $NewPassword"
    }
    finally {
        Step "Restoring pg_hba.conf (back to secure auth)"
        Copy-Item $HbaBackup $HbaConf -Force
        Good "pg_hba.conf restored from backup."

        Restart-Service $ServiceName -Force
        Start-Sleep -Seconds 3
        Good "Service restarted with secure auth."
    }

    # Re-verify
    if (-not (Test-PostgresPassword -Password $NewPassword)) {
        Die "Password reset reported success but connection still fails. Check Event Viewer."
    }
    Good "Password verified under secure auth."
}

# --- 2. Create database if missing -------------------------
Step "Ensuring database '$DbName' exists"
if (Test-DatabaseExists -Password $NewPassword -DbName $DbName) {
    Good "Database '$DbName' already exists."
} else {
    $env:PGPASSWORD = $NewPassword
    & $PsqlExe -U postgres -d postgres -c "CREATE DATABASE $DbName;" | Out-Null
    $createCode = $LASTEXITCODE
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($createCode -ne 0) { Die "Failed to create database '$DbName'." }
    Good "Database '$DbName' created."
}

# --- 3. Final connection smoke test ------------------------
Step "Verifying connection to '$DbName'"
$env:PGPASSWORD = $NewPassword
& $PsqlExe -U postgres -d $DbName -c "SELECT 'ok' AS status;" | Out-Null
$smokeCode = $LASTEXITCODE
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
if ($smokeCode -ne 0) { Die "Could not connect to '$DbName' with new password." }
Good "Database '$DbName' is reachable."

# --- 6. Write .env and .env.local --------------------------
Step "Writing .env and .env.local"
$envContent = @"
# Generated by setup-taha-os.ps1
DATABASE_URL="postgresql://postgres:$NewPassword@localhost:5432/$DbName"
JWT_SECRET="taha-media-secret-key-2026-afzal"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
"@
Set-Content -Path $EnvPath      -Value $envContent -Encoding UTF8
Set-Content -Path $EnvLocalPath -Value $envContent -Encoding UTF8
Good ".env and .env.local updated."

# --- 7. Prisma generate + db push --------------------------
Step "Running prisma generate + db push"
& npx prisma generate
if ($LASTEXITCODE -ne 0) { Die "prisma generate failed." }
& npx prisma db push
if ($LASTEXITCODE -ne 0) { Die "prisma db push failed. Is the schema valid?" }
Good "Database schema synced."

# --- 8. Seed demo accounts ---------------------------------
Step "Seeding demo accounts (admin/editor/designer/axsclient)"
& npm run db:seed
if ($LASTEXITCODE -ne 0) { Die "Seed failed. Check prisma/seed.ts." }
Good "Seed complete."

# --- 9. Done -----------------------------------------------
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " SUCCESS! Taha Media OS is ready."              -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Postgres password: $NewPassword"
Write-Host " Database:          $DbName"
Write-Host ""
Write-Host " Login credentials at http://localhost:3000 :"
Write-Host "   admin      / admin123"
Write-Host "   editor     / editor123"
Write-Host "   designer   / designer123"
Write-Host "   axsclient  / client123"
Write-Host ""
Write-Host "Next step: in this folder run  npm run dev"     -ForegroundColor Cyan
Write-Host "(or re-run it in the terminal where you usually start the app)"
Write-Host ""
Write-Host "Press Enter to close..." -ForegroundColor Yellow
[void](Read-Host)
