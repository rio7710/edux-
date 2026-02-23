$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pidDir = Join-Path $root ".runtime"

function Stop-ByPidFile {
  param([string]$Name)
  $pidFile = Join-Path $pidDir "$Name.pid"
  if (-not (Test-Path $pidFile)) { return }
  $raw = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  $procId = 0
  if ($raw -and [int]::TryParse($raw, [ref]$procId) -and $procId -gt 0) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      Write-Host "[dev-down] stopped $Name (pid=$procId)"
    } catch {
      Write-Host "[dev-down] skip $Name (pid=$procId)"
    }
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "[dev-down] stopping managed processes..."
Stop-ByPidFile -Name "backend"
Stop-ByPidFile -Name "ui"
Stop-ByPidFile -Name "worker"

Write-Host "[dev-down] done"
