param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-TcpPort($computerName, $port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($computerName, $port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(800)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Wait-ForPort($port, $seconds) {
  for ($i = 0; $i -lt $seconds; $i++) {
    if (Test-TcpPort 'localhost' $port) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

Write-Host ''
Write-Host 'FinTech Bank - starting development servers' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $root 'server\.env'))) {
  Write-Host 'server/.env is missing. Run setup.bat first.' -ForegroundColor Red
  exit 1
}
if (-not (Test-Path (Join-Path $root 'node_modules')) -or -not (Test-Path (Join-Path $root 'client\node_modules'))) {
  Write-Host 'Dependencies are missing. Run setup.bat first.' -ForegroundColor Red
  exit 1
}

if (Test-TcpPort 'localhost' 5000) {
  Write-Host 'API already running on http://localhost:5000 (not starting a second copy).' -ForegroundColor Yellow
} else {
  Write-Host 'Starting API on http://localhost:5000 ...' -ForegroundColor Green
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'title "FinTech Bank API" & npm run dev:server' -WorkingDirectory $root
}

if (Test-TcpPort 'localhost' 5173) {
  Write-Host 'Web app already running on http://localhost:5173 (not starting a second copy).' -ForegroundColor Yellow
} else {
  Write-Host 'Starting web app on http://localhost:5173 ...' -ForegroundColor Green
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'title "FinTech Bank Web" & npm run dev:client' -WorkingDirectory $root
}

Write-Host ''
Write-Host 'Waiting for the servers (up to 90 seconds)...' -ForegroundColor DarkGray
$apiReady = Wait-ForPort 5000 30
$webReady = Wait-ForPort 5173 90

Write-Host ''
if ($apiReady) {
  Write-Host '  API:     http://localhost:5000/api/health' -ForegroundColor Green
} else {
  Write-Host '  API:     not responding yet - check the "FinTech Bank API" window.' -ForegroundColor Yellow
}
if ($webReady) {
  Write-Host '  Web app: http://localhost:5173' -ForegroundColor Green
} else {
  Write-Host '  Web app: not responding yet - check the "FinTech Bank Web" window.' -ForegroundColor Yellow
}

if (-not $NoBrowser -and $webReady) {
  Start-Process 'http://localhost:5173'
}

Write-Host ''
Write-Host 'Demo login: SUPER001 / Admin@123'
Write-Host 'Close the two server windows to stop the app.'
Write-Host ''
