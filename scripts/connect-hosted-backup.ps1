$ErrorActionPreference='Stop'
$Host.UI.RawUI.WindowTitle='MERYO SQL - V4 CERTIFICADO VERIFICADO'
try {
 $privateRoot=Join-Path $env:LOCALAPPDATA 'MERYO-deployment'
 New-Item -ItemType Directory -Path $privateRoot -Force | Out-Null
 $owner=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
 & icacls.exe $privateRoot /inheritance:r /grant:r "${owner}:(OI)(CI)F" | Out-Null
 if($LASTEXITCODE -ne 0){throw 'No se pudo proteger la carpeta privada'}
 if(!(Test-Path -LiteralPath (Join-Path $privateRoot 'tls-status.json'))){throw 'Falta validar el certificado oficial antes de pedir contrasena'}
 Write-Host 'MERYO SQL - V4 CERTIFICADO VERIFICADO' -ForegroundColor Cyan
 Write-Host 'Certificado oficial y nombre del servidor ya comprobados. SSL sigue protegido.'
 Write-Host 'Esta version no utiliza StandardInputEncoding.'
 Write-Host 'MERYO: conexion PostgreSQL del proyecto alojado meryo.'
 Write-Host 'Introduce la contrasena PostgreSQL vigente. NO la del USB ni codigos de Authenticator.'
 Write-Host 'Solo se verificara una consulta de lectura; no se cambiara la contrasena ni la base.'
 $secret=Read-Host 'Contrasena PostgreSQL (no se muestra)' -AsSecureString
 $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
 try {
  $start=New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName=(Get-Command node.exe).Source
  $start.Arguments='--use-system-ca "'+(Join-Path $PSScriptRoot 'connect-hosted-backup.mjs')+'"'
  $start.UseShellExecute=$false;$start.CreateNoWindow=$true
  $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $proc=New-Object System.Diagnostics.Process;$proc.StartInfo=$start;[void]$proc.Start()
  $bytes=[Text.Encoding]::UTF8.GetBytes((@{password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)}|ConvertTo-Json -Compress)+"`n")
  try {$proc.StandardInput.BaseStream.Write($bytes,0,$bytes.Length);$proc.StandardInput.BaseStream.Flush();$proc.StandardInput.Close()}
  finally {[Array]::Clear($bytes,0,$bytes.Length)}
  $result=$proc.StandardOutput.ReadToEnd();$failure=$proc.StandardError.ReadToEnd();$proc.WaitForExit()
  if($proc.ExitCode -ne 0){throw $failure}
  Write-Host $result -ForegroundColor Green
 }finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$secret.Dispose()}
}catch{Write-Host ('No se completo: '+$_.Exception.Message) -ForegroundColor Red}
Read-Host 'Pulsa Intro para cerrar'
