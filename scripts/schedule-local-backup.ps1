$ErrorActionPreference = 'Stop'
$backupRoot = Join-Path $env:LOCALAPPDATA 'MERYO-backups'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $backupRoot /inheritance:r /grant:r "${owner}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo restringir el directorio privado de respaldos' }
$action = New-ScheduledTaskAction -Execute $nodePath -Argument ('"' + (Join-Path $PSScriptRoot 'run-backup.mjs') + '"') -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '03:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $owner -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'MERYO-Backup-Local-Diario' -Description 'Respaldo cifrado SOLO del PostgreSQL y archivos locales MERYO; copia independiente pendiente hasta configurar destino. Retencion 30 dias. Requiere sesion Windows iniciada.' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Output 'Tarea local registrada: diaria a las 03:00, al estar disponible y con sesion Windows iniciada. Aun debe verificarse su ejecucion.'
