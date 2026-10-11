# scripts/package.ps1
# Windows PowerShell packaging script for Chrome and Firefox releases.
# Uses system built-in tar or Compress-Archive.
# Excludes scripts/, tests/, *.md, git, and release archives.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/package.ps1 [-Target chrome|firefox|all]
# Outputs:
#   chrome:  release/fb-layout-tweaks-v<version>.zip
#   firefox: release/fb-layout-tweaks-firefox-v<version>.zip (manifest patched with gecko block)

param(
    [ValidateSet("chrome", "firefox", "all")]
    [string]$Target = "chrome"
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $rootDir "manifest.json"
$releaseDir = Join-Path $rootDir "release"

if (-not (Test-Path $manifestPath)) {
    Write-Error "manifest.json not found in $rootDir"
    exit 1
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = if ($manifest.version) { $manifest.version } else { "1.0.0" }
$slug = "fb-layout-tweaks"
$includeItems = @("manifest.json", "icons", "src", "_locales")

if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
}

function New-PackageZip {
    param([string]$SourceDir, [string]$ZipPath)

    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath -Force
    }

    $tarCmd = Get-Command tar.exe -ErrorAction SilentlyContinue
    if ($tarCmd) {
        Push-Location $SourceDir
        try {
            & tar.exe -a -cf $ZipPath manifest.json icons src _locales
        } finally {
            Pop-Location
        }
    } else {
        $fullPaths = $includeItems | ForEach-Object { Join-Path $SourceDir $_ }
        Compress-Archive -Path $fullPaths -DestinationPath $ZipPath -Force
    }

    if (-not (Test-Path $ZipPath)) {
        Write-Error "Failed to create package at $ZipPath"
        exit 1
    }
    $sizeKb = [math]::Round((Get-Item $ZipPath).Length / 1KB, 1)
    Write-Host "✓ Package created successfully!" -ForegroundColor Green
    Write-Host "  File: release/$(Split-Path $ZipPath -Leaf) ($sizeKb KB)"
    Write-Host "  Included: $($includeItems -join ', ')"
    Write-Host "  Excluded: scripts/, tests/, *.md, git data, etc."
}

if ($Target -eq "chrome" -or $Target -eq "all") {
    Write-Host "Packaging $slug v$version for Chrome..."
    New-PackageZip -SourceDir $rootDir -ZipPath (Join-Path $releaseDir "$slug-v$version.zip")
}

if ($Target -eq "firefox" -or $Target -eq "all") {
    Write-Host "Packaging $slug v$version for Firefox..."
    $stageDir = Join-Path ([System.IO.Path]::GetTempPath()) "$slug-firefox-$([System.Guid]::NewGuid().ToString('N'))"
    try {
        New-Item -ItemType Directory -Path $stageDir | Out-Null
        foreach ($item in $includeItems) {
            Copy-Item -Path (Join-Path $rootDir $item) -Destination (Join-Path $stageDir $item) -Recurse -Force
        }
        $geckoId = if ($env:FIREFOX_EXTENSION_ID) { $env:FIREFOX_EXTENSION_ID } else { "fb-layout-tweaks@amppa.github.io" }
        $stagedManifestPath = Join-Path $stageDir "manifest.json"
        $staged = Get-Content $stagedManifestPath -Raw | ConvertFrom-Json
        $staged | Add-Member -NotePropertyName "browser_specific_settings" -NotePropertyValue ([pscustomobject]@{
            gecko = [pscustomobject]@{
                id                 = $geckoId
                strict_min_version = "121.0"
            }
        }) -Force
        $staged | ConvertTo-Json -Depth 10 | Set-Content $stagedManifestPath -Encoding UTF8
        Write-Host "  Gecko ID: $geckoId"
        New-PackageZip -SourceDir $stageDir -ZipPath (Join-Path $releaseDir "$slug-firefox-v$version.zip")
    } finally {
        if (Test-Path $stageDir) {
            Remove-Item $stageDir -Recurse -Force
        }
    }
}
