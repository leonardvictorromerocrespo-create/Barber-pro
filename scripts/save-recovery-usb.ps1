param([ValidatePattern('^[A-Z]$')][string]$DriveLetter='E')
$ErrorActionPreference='Stop'
try {
 $volume=Get-Volume -DriveLetter $DriveLetter -ErrorAction Stop
 $disk=Get-Partition -DriveLetter $DriveLetter | Get-Disk
 if($disk.BusType -ne 'USB' -or $volume.HealthStatus -ne 'Healthy'){throw 'El destino debe ser un USB saludable'}
 $driveRoot=$DriveLetter+':\'
 $destination=Join-Path $driveRoot ('MERYO-Recuperacion-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
 if([IO.Path]::GetFullPath($destination).StartsWith($driveRoot) -ne $true -or (Test-Path -LiteralPath $destination)){throw 'Destino inseguro o existente'}
 New-Item -ItemType Directory -Path $destination -ErrorAction Stop | Out-Null
 $helper=Join-Path $destination 'recovery-key.mjs'
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\server\recovery-key.mjs') -Destination $helper -ErrorAction Stop
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'recovery-password.ps1') -Destination (Join-Path $destination 'recovery-password.ps1') -ErrorAction Stop
 $keyFile=Join-Path $env:LOCALAPPDATA 'MERYO-backups\recovery\backup.key'
 $encrypted=Join-Path $destination 'backup-key.encrypted.json'
 Write-Host 'MERYO: guardar clave de respaldo cifrada en USB. No es el codigo de Authenticator.'
 Write-Host 'Elige una contrasena que puedas conservar fuera del USB. No la compartas por chat.'
 $result=& (Join-Path $PSScriptRoot 'recovery-password.ps1') -Mode seal -SourceFile $keyFile -DestinationFile $encrypted -HelperFile $helper
 if(($result|ConvertFrom-Json).verified -ne $true){throw 'La recuperacion no quedo verificada'}
 @'
MERYO - CLAVE DE RECUPERACION CIFRADA

Esta carpeta NO contiene respaldos de la base ni codigos de Authenticator.
Guarda este USB separado de Drive y conserva su contrasena en otro lugar seguro.
No cambies ni publiques backup-key.encrypted.json.

Para recuperar en Windows con Node.js oficial instalado:
1. Abre PowerShell en esta carpeta.
2. Ejecuta (elige una ruta PRIVADA de salida que no exista):
   powershell -NoProfile -File .\recovery-password.ps1 -Mode unlock -SourceFile .\backup-key.encrypted.json -DestinationFile C:\RUTA-PRIVADA\backup.key -HelperFile .\recovery-key.mjs
3. Introduce la contrasena SOLO en la ventana local. El archivo recuperado es
   una clave sensible: nunca lo subas a Drive, Git ni lo envies por chat.
4. Usa esa clave con el restaurador MERYO y el respaldo .meryo.enc descargado.
   Restaura siempre primero en una base y carpeta separadas.

Perder esta contrasena y la clave original impide recuperar los respaldos.
El procedimiento de Authenticator se configura por separado; no omite MFA.
'@ | Set-Content -LiteralPath (Join-Path $destination 'LEEME.txt') -Encoding UTF8
 $status=@{verifiedAt=(Get-Date).ToUniversalTime().ToString('o');encryptedFile=$encrypted;usbLabel=$volume.FileSystemLabel;encrypted=$true;keyRoundTripVerified=$true;containsDatabaseArchives=$false;containsAuthenticatorSecret=$false}
 $status|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'MERYO-backups\usb-recovery-status.json') -Encoding UTF8
 Write-Host ('COPIA Y RECUPERACION DE CLAVE VERIFICADAS: '+$destination) -ForegroundColor Green
 Write-Host 'Guarda el USB y la contrasena por separado. No se modifico produccion.'
}catch{Write-Host ('No se completo: '+$_.Exception.Message) -ForegroundColor Red}
Read-Host 'Pulsa Intro para cerrar'
