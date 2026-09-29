param([string]$Python = 'C:\Users\11528\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$local = Join-Path $root '.local-server'
New-Item -ItemType Directory -Force -Path $local | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $local 'server.crt'))) {
    & $Python (Join-Path $PSScriptRoot 'setup-local-tls.py')
    if ($LASTEXITCODE -ne 0) { throw 'TLS setup failed' }
}
$listener = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($listener) { Write-Output 'Port 8787 already has a listener; existing server left running.'; exit 0 }
$process = Start-Process -FilePath $Python -ArgumentList '-m','server.app' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $local 'server.log') -RedirectStandardError (Join-Path $local 'server-error.log') -PassThru
$process.Id | Set-Content -LiteralPath (Join-Path $local 'server.pid')
Write-Output "Local HTTPS database service started (PID $($process.Id))."
