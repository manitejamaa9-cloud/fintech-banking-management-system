$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$script:problems = @()

function Write-Step($label, $ok, $detail = '') {
  if ($ok) {
    Write-Host ("  [OK]   {0} {1}" -f $label, $detail) -ForegroundColor Green
  } else {
    Write-Host ("  [FAIL] {0} {1}" -f $label, $detail) -ForegroundColor Red
    $script:problems += $label
  }
}

function Write-Note($text) {
  Write-Host ("         {0}" -f $text) -ForegroundColor DarkGray
}

function Test-TcpPort($computerName, $port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($computerName, $port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(1500)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

Write-Host ''
Write-Host 'FinTech Bank - environment check' -ForegroundColor Cyan
Write-Host '================================' -ForegroundColor Cyan

Write-Host ''
Write-Host 'Runtime'

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $nodeVersion = (& node --version).Trim()
  $nodeMajor = 0
  [void][int]::TryParse(($nodeVersion.TrimStart('v') -split '\.')[0], [ref]$nodeMajor)
  Write-Step 'Node.js' ($nodeMajor -ge 18) $nodeVersion
  if ($nodeMajor -lt 18) { Write-Note 'Install Node.js 18 or newer from https://nodejs.org' }
} else {
  Write-Step 'Node.js' $false 'not found on PATH'
  Write-Note 'Install Node.js 18 or newer from https://nodejs.org and reopen this window.'
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npm) {
  Write-Step 'npm' $true ((& npm.cmd --version).Trim())
} else {
  Write-Step 'npm' $false 'not found on PATH'
}

Write-Host ''
Write-Host 'Project files'

$envPath = Join-Path $root 'server\.env'
$envVars = @{}
if (Test-Path $envPath) {
  Write-Step 'server/.env' $true 'found'
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
      $envVars[$matches[1]] = $matches[2].Trim()
    }
  }

  $jwt = [string]$envVars['JWT_SECRET']
  Write-Step 'JWT_SECRET' ($jwt.Length -ge 16) ("length {0}" -f $jwt.Length)
  if ($jwt.Length -lt 16) { Write-Note 'Set a value of at least 16 characters in server/.env.' }

  $password = [string]$envVars['PGPASSWORD']
  $passwordLooksPlaceholder = $password -match 'your-postgres-password|^postgres$'
  if ($password.Length -eq 0) {
    Write-Step 'PGPASSWORD' $false 'empty'
  } elseif ($passwordLooksPlaceholder) {
    Write-Step 'PGPASSWORD' $false 'still the example value'
    Write-Note 'Set the real PostgreSQL password in server/.env.'
  } else {
    Write-Step 'PGPASSWORD' $true 'configured'
  }
} else {
  Write-Step 'server/.env' $false 'missing'
  Write-Note 'Run setup.bat, or copy .env.example to server\.env and edit it.'
}

Write-Step 'Root dependencies' (Test-Path (Join-Path $root 'node_modules')) $(if (Test-Path (Join-Path $root 'node_modules')) { 'installed' } else { 'run setup.bat' })
Write-Step 'Client dependencies' (Test-Path (Join-Path $root 'client\node_modules')) $(if (Test-Path (Join-Path $root 'client\node_modules')) { 'installed' } else { 'run setup.bat' })
Write-Step 'Built client' (Test-Path (Join-Path $root 'client\dist\index.html')) $(if (Test-Path (Join-Path $root 'client\dist\index.html')) { 'client/dist present' } else { 'optional: npm run build' })

Write-Host ''
Write-Host 'PostgreSQL'

$pgHost = if ($envVars['PGHOST']) { $envVars['PGHOST'] } else { 'localhost' }
$pgPort = if ($envVars['PGPORT']) { [int]$envVars['PGPORT'] } else { 5432 }
Write-Step ("Port {0}:{1}" -f $pgHost, $pgPort) (Test-TcpPort $pgHost $pgPort) $(if (Test-TcpPort $pgHost $pgPort) { 'accepting connections' } else { 'not reachable' })
if (-not (Test-TcpPort $pgHost $pgPort)) {
  Write-Note 'Start the service: Get-Service postgresql* | Start-Service'
}

if (Test-Path $envPath) {
  Write-Host ''
  Write-Host 'Database contents'
  Push-Location (Join-Path $root 'server')
  try {
    & node 'scripts/db-status.js' 2>&1 | ForEach-Object { Write-Host ("  {0}" -f $_) }
    $dbExit = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($dbExit -ne 0) {
    Write-Step 'Database connection' $false 'see message above'
  } else {
    Write-Step 'Database connection' $true 'ok'
  }
}

Write-Host ''
Write-Host 'Local ports'

foreach ($port in 5000, 5173) {
  $inUse = Test-TcpPort 'localhost' $port
  if ($inUse) {
    Write-Host ("  [INFO] Port {0} is in use (the app may already be running)." -f $port) -ForegroundColor Yellow
  } else {
    Write-Host ("  [OK]   Port {0} is free." -f $port) -ForegroundColor Green
  }
}

Write-Host ''
if ($script:problems.Count -gt 0) {
  Write-Host ("Environment check failed ({0} item(s))." -f $script:problems.Count) -ForegroundColor Red
  Write-Host 'Fix the items marked [FAIL], then run this check again.' -ForegroundColor Red
  exit 1
}

Write-Host 'Environment looks good. Start the app with start.bat.' -ForegroundColor Green
exit 0
