param(
  [string]$PostgresPassword = '',
  [switch]$SkipInstall,
  [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$envPath = Join-Path $root 'server\.env'

function Write-Step($text) {
  Write-Host ''
  Write-Host (">> {0}" -f $text) -ForegroundColor Cyan
}

function Set-EnvValue($path, $key, $value) {
  $lines = @(Get-Content $path)
  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match ("^\s*{0}\s*=" -f [regex]::Escape($key))) {
      $found = $true
      "{0}={1}" -f $key, $value
    } else {
      $line
    }
  }
  if (-not $found) { $updated = @($updated) + ("{0}={1}" -f $key, $value) }
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($path, [string[]]$updated, $utf8)
}

function Get-EnvValue($path, $key) {
  if (-not (Test-Path $path)) { return '' }
  $match = Get-Content $path | Where-Object { $_ -match ("^\s*{0}\s*=(.*)$" -f [regex]::Escape($key)) } | Select-Object -Last 1
  if (-not $match) { return '' }
  return ($match -replace ("^\s*{0}\s*=" -f [regex]::Escape($key)), '').Trim()
}

function New-RandomSecret() {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes)
}

Write-Host ''
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ' FinTech Bank - first-time setup (Windows)' -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan

Write-Step 'Checking Node.js and npm'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host 'Node.js was not found on PATH.' -ForegroundColor Red
  Write-Host 'Install Node.js 18 or newer from https://nodejs.org, reopen the terminal, then run setup.bat again.'
  exit 1
}
$nodeVersion = (& node --version).Trim()
$nodeMajor = 0
[void][int]::TryParse(($nodeVersion.TrimStart('v') -split '\.')[0], [ref]$nodeMajor)
if ($nodeMajor -lt 18) {
  Write-Host ("Node.js {0} is too old. Install version 18 or newer." -f $nodeVersion) -ForegroundColor Red
  exit 1
}
Write-Host ("Node.js {0}, npm {1}" -f $nodeVersion, (& npm.cmd --version).Trim()) -ForegroundColor Green

Write-Step 'Preparing server/.env'
if (-not (Test-Path $envPath)) {
  Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $envPath
  Write-Host 'Created server/.env from .env.example.' -ForegroundColor Green
} else {
  Write-Host 'server/.env already exists; keeping your other settings.' -ForegroundColor Green
}

$jwt = Get-EnvValue $envPath 'JWT_SECRET'
if ($jwt.Length -lt 16 -or $jwt -match 'replace-this|change-me|your-') {
  Set-EnvValue $envPath 'JWT_SECRET' (New-RandomSecret)
  Write-Host 'Generated a random JWT_SECRET for local development.' -ForegroundColor Green
}

Write-Step 'PostgreSQL password'
$currentPassword = Get-EnvValue $envPath 'PGPASSWORD'
if ($PostgresPassword) {
  $chosenPassword = $PostgresPassword
  Write-Host 'Using the password passed on the command line.'
} else {
  $prompt = "Password for PostgreSQL user 'postgres'"
  if ($currentPassword -and $currentPassword -notmatch 'your-postgres-password|^postgres$') {
    $prompt += ' (press Enter to keep the current value)'
  } else {
    $prompt += ' (press Enter for "postgres")'
  }
  $entered = Read-Host $prompt
  if ([string]::IsNullOrWhiteSpace($entered)) {
    if ($currentPassword -and $currentPassword -notmatch 'your-postgres-password|^postgres$') {
      $chosenPassword = $currentPassword
    } else {
      $chosenPassword = 'postgres'
    }
  } else {
    $chosenPassword = $entered
  }
}
if (-not $chosenPassword) { $chosenPassword = 'postgres' }
Set-EnvValue $envPath 'PGPASSWORD' $chosenPassword
Write-Host 'Saved PGUSER/PGPASSWORD settings in server/.env.' -ForegroundColor Green

if (-not $SkipInstall) {
  Write-Step 'Installing dependencies (this can take a minute)'
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'npm install failed. Scroll up for the error.' -ForegroundColor Red
    exit 1
  }
  Write-Host 'Dependencies installed.' -ForegroundColor Green
} else {
  Write-Host ''
  Write-Host 'Skipping npm install (-SkipInstall).' -ForegroundColor Yellow
}

Write-Step 'Creating the database, tables and demo data'
& npm.cmd run db:init
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Database setup failed. Common fixes:' -ForegroundColor Red
  Write-Host '  1. Is PostgreSQL running?  Get-Service postgresql*'
  Write-Host '  2. Is the password correct in server/.env?'
  Write-Host '  3. Does the user have permission to create databases?'
  Write-Host 'Fix the problem, then run setup.bat again (it is safe to re-run).'
  exit 1
}
Write-Host 'Database is ready.' -ForegroundColor Green

if (-not $SkipTests) {
  Write-Step 'Running the test suite'
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Tests failed. The app may still start, but check the output above.' -ForegroundColor Yellow
  } else {
    Write-Host 'All tests passed.' -ForegroundColor Green
  }
}

Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Host ' Setup complete' -ForegroundColor Green
Write-Host '==========================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Start the app by double-clicking start.bat.'
Write-Host 'The browser opens at http://localhost:5173'
Write-Host ''
Write-Host 'Demo logins'
Write-Host '  Super admin   SUPER001 / Admin@123'
Write-Host '  Bank manager  BM1001   / Manager@123'
Write-Host '  Finance       FIN001   / Finance@123'
Write-Host '  Viewer        VIEW001  / View@123'
Write-Host ''
Write-Host 'Useful commands (from this folder):'
Write-Host '  npm run check      typecheck + backend tests'
Write-Host '  npm run db:status  show database row counts'
Write-Host '  npm run seed:force reset only the demo rows'
Write-Host ''

