# tests/test.ps1
# Pure PowerShell unit test runner (Zero dependencies, works out-of-the-box on Windows)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot

Write-Host "Running FB Trim Unit Tests (PowerShell)..." -ForegroundColor Cyan
$passed = 0
$failed = 0

function Assert-Condition($condition, $message) {
    if ($condition) {
        Write-Host "  ✓ $message" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  ✗ $message" -ForegroundColor Red
        $script:failed++
    }
}

# Test 1: i18n symmetry
$enPath = Join-Path $rootDir "_locales/en/messages.json"
$zhPath = Join-Path $rootDir "_locales/zh_TW/messages.json"

if ((Test-Path $enPath) -and (Test-Path $zhPath)) {
    $enJson = Get-Content $enPath -Raw | ConvertFrom-Json
    $zhJson = Get-Content $zhPath -Raw | ConvertFrom-Json

    $enKeys = $enJson.PSObject.Properties.Name | Sort-Object
    $zhKeys = $zhJson.PSObject.Properties.Name | Sort-Object

    $diffEnZh = Compare-Object $enKeys $zhKeys
    Assert-Condition ($null -eq $diffEnZh) "i18n message keys are 100% symmetrically aligned between en and zh_TW"
} else {
    Assert-Condition $false "Locale message files must exist"
}

# Test 2: Verify options.html accessibility (aria-label)
$optionsHtmlPath = Join-Path $rootDir "src/options/options.html"
if (Test-Path $optionsHtmlPath) {
    $htmlContent = Get-Content $optionsHtmlPath -Raw
    $inputsWithoutAria = [regex]::Matches($htmlContent, '<input[^>]+id="([^"]+)"[^>]*>') | Where-Object {
        $_.Value -notmatch 'aria-label='
    }
    Assert-Condition ($inputsWithoutAria.Count -eq 0) "All <input> elements with id in options.html have aria-label"
} else {
    Assert-Condition $false "options.html must exist"
}

# Test 3: Verify defaults.js keys are present in options.html
$defaultsPath = Join-Path $rootDir "src/shared/defaults.js"
if (Test-Path $defaultsPath) {
    $defaultsText = Get-Content $defaultsPath -Raw
    $hideKeys = [regex]::Matches($defaultsText, '(hide[A-Za-z0-9]+)\s*:') | ForEach-Object { $_.Groups[1].Value }
    
    $fixedKeys = @('hideLeftProfile', 'hideLeftFeeds')
    $configurableKeys = $hideKeys | Where-Object { $fixedKeys -notcontains $_ }
    $missingInHtml = @()
    foreach ($key in $configurableKeys) {
        if ($htmlContent -notmatch "id=`"$key`"") {
            $missingInHtml += $key
        }
    }
    if ($missingInHtml.Count -gt 0) {
        Write-Host "    (Missing configurable keys in options.html: $($missingInHtml -join ', '))" -ForegroundColor Yellow
    }
    Assert-Condition ($missingInHtml.Count -eq 0) "All configurable hide* toggles in defaults.js exist in options.html (total $($configurableKeys.Count) toggles)"
} else {
    Assert-Condition $false "defaults.js must exist"
}

# Test 4: Verify icons integrity (16, 32, 48, 128)
$requiredIcons = @(16, 32, 48, 128)
$iconsValid = $true
Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue

foreach ($size in $requiredIcons) {
    $iconPath = Join-Path $rootDir "icons/icon$size.png"
    if (-not (Test-Path $iconPath)) {
        Write-Host "    (Missing icon: icons/icon$size.png)" -ForegroundColor Yellow
        $iconsValid = $false
    } else {
        try {
            $img = [System.Drawing.Image]::FromFile($iconPath)
            if ($img.Width -ne $size -or $img.Height -ne $size) {
                Write-Host "    (Invalid dimension for icon$size.png: $($img.Width)x$($img.Height), expected ${size}x${size})" -ForegroundColor Yellow
                $iconsValid = $false
            }
            $img.Dispose()
        } catch {
            # Non-fatal if System.Drawing is unavailable in headless
        }
    }
}
Assert-Condition $iconsValid "All production icons (16, 32, 48, 128px) exist and have correct dimensions"

Write-Host ""
if ($failed -eq 0) {
    Write-Host "All $passed tests passed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failed test(s) failed." -ForegroundColor Red
    exit 1
}
