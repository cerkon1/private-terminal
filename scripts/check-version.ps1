# Fails if the app version disagrees across the files a release bump touches.
# The frontend reads its displayed version from package.json at build time
# (vite.config.ts `define`), so these three are the whole set.
#
#   pwsh scripts/check-version.ps1               # consistency only
#   pwsh scripts/check-version.ps1 -Tag v1.0.3   # also require tag == version
param([string]$Tag)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$versions = [ordered]@{
    'package.json'              = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
    'src-tauri/tauri.conf.json' = (Get-Content (Join-Path $root 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json).version
    'src-tauri/Cargo.toml'      = (Select-String -Path (Join-Path $root 'src-tauri/Cargo.toml') -Pattern '^version = "(.+)"' |
                                   Select-Object -First 1).Matches[0].Groups[1].Value
}
$versions.GetEnumerator() | ForEach-Object { '{0,-28} {1}' -f $_.Key, $_.Value }

$distinct = @($versions.Values | Sort-Object -Unique)
if ($distinct.Count -ne 1) {
    Write-Error "Version mismatch across files: $($distinct -join ', ')"
}
if ($Tag -and $Tag -ne "v$($distinct[0])") {
    Write-Error "Tag '$Tag' does not match version v$($distinct[0])"
}
"OK: v$($distinct[0])"
