param([string]$JavaHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($JavaHome) { $env:JAVA_HOME = $JavaHome }
Push-Location (Join-Path $projectRoot 'android')
try {
    & .\gradlew.bat assembleDebug lintDebug --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build or lint failed.' }
    $apkPath = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    Copy-Item -LiteralPath $apkPath -Destination (Join-Path $projectRoot 'app-debug.apk')
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'artifacts') | Out-Null
    Copy-Item -LiteralPath $apkPath -Destination (Join-Path $projectRoot 'artifacts\family-life-mobile-v2-1.5.0.apk')
    Get-FileHash -LiteralPath $apkPath -Algorithm SHA256
} finally { Pop-Location }
