$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root "logs"
$pidDir = Join-Path $root ".runtime"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
New-Item -ItemType Directory -Path $pidDir -Force | Out-Null

function Get-ListeningPidsByPort {
  param([int]$Port)

  $lines = netstat -ano -p tcp | Select-String ":$Port\s+.*LISTENING\s+(\d+)$"
  $procIds = @()
  foreach ($line in $lines) {
    $parts = ($line.ToString().Trim() -split "\s+")
    if ($parts.Length -gt 0) {
      $procId = 0
      if ([int]::TryParse($parts[$parts.Length - 1], [ref]$procId)) {
        if ($procId -gt 0 -and $procId -notin $procIds) {
          $procIds += $procId
        }
      }
    }
  }
  return $procIds
}

function Stop-ByPidFile {
  param([string]$Name)
  $pidFile = Join-Path $pidDir "$Name.pid"
  if (-not (Test-Path $pidFile)) { return }
  $raw = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  $procId = 0
  if ($raw -and [int]::TryParse($raw, [ref]$procId) -and $procId -gt 0) {
    try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

function Wait-Port {
  param(
    [int]$Port,
    [int]$TimeoutSec = 20
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $found = Get-ListeningPidsByPort -Port $Port
    $listeningCount = @($found | Where-Object { $_ -is [int] -and $_ -gt 0 }).Count
    if ($listeningCount -gt 0) { return $true }
    Start-Sleep -Milliseconds 300
  }
  return $false
}

Write-Host "[dev-up] stopping previous managed processes..."
Stop-ByPidFile -Name "backend"
Stop-ByPidFile -Name "ui"
Stop-ByPidFile -Name "worker"

Write-Host "[dev-up] freeing ports 7777/5173..."
$portProcIds = @()
$portProcIds += Get-ListeningPidsByPort -Port 7777
$portProcIds += Get-ListeningPidsByPort -Port 5173
$portProcIds = $portProcIds | Sort-Object -Unique
foreach ($procId in $portProcIds) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  } catch {}
}

Write-Host "[dev-up] starting backend..."
$backend = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "npx tsx src/transport.ts" `
  -WorkingDirectory $root `
  -PassThru
Set-Content -Path (Join-Path $pidDir "backend.pid") -Value "$($backend.Id)"

Write-Host "[dev-up] starting ui..."
$ui = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "npm --prefix ui run dev" `
  -WorkingDirectory $root `
  -PassThru
Set-Content -Path (Join-Path $pidDir "ui.pid") -Value "$($ui.Id)"

Write-Host "[dev-up] starting worker..."
$worker = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "npx tsx src/workers/pdfWorker.ts" `
  -WorkingDirectory $root `
  -PassThru
Set-Content -Path (Join-Path $pidDir "worker.pid") -Value "$($worker.Id)"

Write-Host "[dev-up] waiting for ports..."
$backendReady = Wait-Port -Port 7777
$uiReady = Wait-Port -Port 5173

if ($backendReady -and $uiReady) {
  Write-Host "[dev-up] ready: backend(7777), ui(5173), worker(started)"
  exit 0
}

Write-Host "[dev-up] warning: startup check failed"
exit 1
