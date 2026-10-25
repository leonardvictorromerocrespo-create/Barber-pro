$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$testDirectory = Join-Path $env:LOCALAPPDATA 'MERYO-tests\pg17-20261024'
$pgControl = 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe'
if (!(Test-Path -LiteralPath (Join-Path $testDirectory 'PG_VERSION'))) { throw 'Falta el cluster local existente. No se creara otro.' }
& $pgControl -D $testDirectory status *> $null
$startedHere = $LASTEXITCODE -ne 0
Push-Location -LiteralPath $projectDirectory
try {
  if ($startedHere) {
    & powershell -NoProfile -File (Join-Path $projectDirectory 'tests\setup-db.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el PostgreSQL del proyecto' }
  }
  & npm.cmd run dev:local:server
} finally {
  if ($startedHere) { & $pgControl -D $testDirectory -m fast -w stop }
  Pop-Location
}
