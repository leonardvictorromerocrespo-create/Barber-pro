param(
 [ValidateSet('seal','unlock')][string]$Mode,
 [string]$SourceFile,
 [string]$DestinationFile,
 [string]$HelperFile
)
$ErrorActionPreference='Stop'
$first=Read-Host 'Contrasena de recuperacion (minimo 14 caracteres; no la envies por chat)' -AsSecureString
$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
try {
 $password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 if($Mode -eq 'seal') {
  if($password.Length -lt 14){throw 'Necesitas al menos 14 caracteres'}
  $second=Read-Host 'Repite la contrasena' -AsSecureString
  $otherBstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
  try {if($password -cne [Runtime.InteropServices.Marshal]::PtrToStringBSTR($otherBstr)){throw 'Las contrasenas no coinciden'}}
  finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($otherBstr);$second.Dispose()}
 }
 foreach($value in @($HelperFile,$SourceFile,$DestinationFile)){if($value.Contains('"')){throw 'Ruta no admitida'}}
 $start=New-Object System.Diagnostics.ProcessStartInfo
 $start.FileName=(Get-Command node.exe -ErrorAction Stop).Source
 $start.Arguments='"'+$HelperFile+'" '+$Mode+' "'+$SourceFile+'" "'+$DestinationFile+'"'
 $start.UseShellExecute=$false;$start.CreateNoWindow=$true
 $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 $proc=New-Object System.Diagnostics.Process;$proc.StartInfo=$start
 [void]$proc.Start()
 $bytes=[Text.Encoding]::UTF8.GetBytes((@{password=$password}|ConvertTo-Json -Compress)+"`n")
 try {$proc.StandardInput.BaseStream.Write($bytes,0,$bytes.Length);$proc.StandardInput.BaseStream.Flush();$proc.StandardInput.Close()}
 finally {[Array]::Clear($bytes,0,$bytes.Length)}
 $result=$proc.StandardOutput.ReadToEnd();$failure=$proc.StandardError.ReadToEnd();$proc.WaitForExit()
 if($proc.ExitCode -ne 0){throw $failure}
 $result
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$first.Dispose();$password=$null
}
