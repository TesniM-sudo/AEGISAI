$ErrorActionPreference = "Stop"

$frontendDir = Split-Path -Parent $PSScriptRoot
$backendDir = Split-Path -Parent $frontendDir
$healthUrl = "http://127.0.0.1:8010/health"

function Test-BackendOnline {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 2
    return $resp.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-Backend {
  if (Test-BackendOnline) {
    Write-Host "Backend already running at 127.0.0.1:8010"
    return
  }

  Write-Host "Starting backend..."
  Start-Process -WindowStyle Hidden -WorkingDirectory $backendDir -FilePath "py" -ArgumentList "-3.14", "run_local.py"

  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-BackendOnline) {
      Write-Host "Backend is online."
      return
    }
  }

  Write-Warning "Backend did not become healthy yet. Frontend will still start."
}

Set-Location $frontendDir
Start-Backend
npm.cmd run start
