$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pidDir = Join-Path $root ".runtime"

function Read-Pid {
  param([string]$Name)
  $pidFile = Join-Path $pidDir "$Name.pid"
  if (-not (Test-Path $pidFile)) { return $null }
  $raw = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  $procId = 0
  if ($raw -and [int]::TryParse($raw, [ref]$procId) -and $procId -gt 0) { return $procId }
  return $null
}

function Is-Alive {
  param([int]$ProcessId)
  try {
    $null = Get-Process -Id $ProcessId -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Get-PortPids {
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

$backendPid = Read-Pid -Name "backend"
$uiPid = Read-Pid -Name "ui"
$workerPid = Read-Pid -Name "worker"

$backendAlive = if ($backendPid -and (Is-Alive -ProcessId $backendPid)) { "yes" } else { "no" }
$uiAlive = if ($uiPid -and (Is-Alive -ProcessId $uiPid)) { "yes" } else { "no" }
$workerAlive = if ($workerPid -and (Is-Alive -ProcessId $workerPid)) { "yes" } else { "no" }

Write-Host ("backend pid: {0} alive: {1}" -f ($(if ($backendPid) { $backendPid } else { "-" }), $backendAlive))
Write-Host ("ui      pid: {0} alive: {1}" -f ($(if ($uiPid) { $uiPid } else { "-" }), $uiAlive))
Write-Host ("worker  pid: {0} alive: {1}" -f ($(if ($workerPid) { $workerPid } else { "-" }), $workerAlive))

$p7777 = (Get-PortPids -Port 7777) -join ","
$p5173 = (Get-PortPids -Port 5173) -join ","

Write-Host ("port 7777 listener pid(s): {0}" -f ($(if ($p7777) { $p7777 } else { "-" })))
Write-Host ("port 5173 listener pid(s): {0}" -f ($(if ($p5173) { $p5173 } else { "-" })))
