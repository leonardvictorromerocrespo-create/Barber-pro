$ErrorActionPreference = 'Stop'
# Start only this project's existing native test cluster. Never touches a Windows service.
$testData = Join-Path $env:LOCALAPPDATA 'MERYO-tests\pg17-20261024'
if (!(Test-Path -LiteralPath (Join-Path $testData 'PG_VERSION'))) { throw 'Initialize the dedicated test cluster as documented first.' }
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D $testData -l (Join-Path $env:LOCALAPPDATA 'MERYO-tests\pg17-20261024.log') -o '-h 127.0.0.1 -p 55440 -c shared_buffers=32MB -c max_connections=20' -w start
if ($LASTEXITCODE -ne 0) { throw 'Could not start project test cluster. Check whether it is already running.' }
