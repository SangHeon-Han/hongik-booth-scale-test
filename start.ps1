$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$boothUrl = 'http://127.0.0.1:4310/'
try {
    $boothResponse = Invoke-WebRequest -Uri $boothUrl -UseBasicParsing -TimeoutSec 2
    if ($boothResponse.Content -match 'HICD 2026') {
        Start-Process $boothUrl
        exit 0
    }
    throw 'Port 4310 is being used by another application.'
} catch {
    if ($_.Exception.Message -match 'another application') { throw }
}
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required. Install Node.js, then run this launcher again.'
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/vite/bin/vite.js'))) {
    & npm.cmd ci --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Please check the message above.' }
$boothProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4310', '--strictPort') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot 'server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'server-error.log')
$boothProcess.Id | Set-Content -LiteralPath (Join-Path $PSScriptRoot '.server.pid')
for ($boothAttempt = 0; $boothAttempt -lt 40; $boothAttempt++) {
    try {
        $boothReady = Invoke-WebRequest -Uri $boothUrl -UseBasicParsing -TimeoutSec 1
        if ($boothReady.Content -match 'HICD 2026') {
            Start-Process $boothUrl
            exit 0
        }
    } catch {}
    if ($boothProcess.HasExited) { throw 'Server could not start. See server-error.log.' }
    Start-Sleep -Milliseconds 200
}
throw 'The server did not become ready. See server-error.log.'
