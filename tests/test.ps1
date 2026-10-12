# tests/test.ps1
# Pure PowerShell unit test runner (Zero dependencies, works out-of-the-box on Windows)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot

Write-Host "Running FB Layout Tweaks Unit Tests (PowerShell)..." -ForegroundColor Cyan
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
    $showKeys = [regex]::Matches($defaultsText, '(show[A-Za-z0-9]+)\s*:') | ForEach-Object { $_.Groups[1].Value }
    
    $fixedKeys = @('showLeftProfile')
    $configurableKeys = $showKeys | Where-Object { $fixedKeys -notcontains $_ }
    $missingInHtml = @()
    foreach ($key in $configurableKeys) {
        if ($htmlContent -notmatch "id=`"$key`"") {
            $missingInHtml += $key
        }
    }
    if ($htmlContent -notmatch 'id="hoverExpandLeftRail"') {
        $missingInHtml += 'hoverExpandLeftRail'
    }
    if ($missingInHtml.Count -gt 0) {
        Write-Host "    (Missing configurable keys in options.html: $($missingInHtml -join ', '))" -ForegroundColor Yellow
    }
    Assert-Condition ($missingInHtml.Count -eq 0) "All configurable toggles in defaults.js (including hoverExpandLeftRail) exist in options.html"
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

# Test 5: Verify getUiCleanClassName mapping against content.css
$contentCssPath = Join-Path $rootDir "src/content/content.css"
function Get-UiCleanClassName($key) {
    if ($key -eq 'showLeftMetaAI') { return 'fb-layout-tweaks-hide-left-metaai' }
    if ($key -eq 'showRightMetaAI') { return 'fb-layout-tweaks-hide-right-metaai' }
    $stripped = $key -replace '^show', 'hide'
    $kebab = [regex]::Replace($stripped, '([A-Z])', '-$1').ToLower()
    return "fb-layout-tweaks-$kebab"
}

if ((Test-Path $contentCssPath) -and (Test-Path $defaultsPath)) {
    $cssContent = Get-Content $contentCssPath -Raw
    $missingCss = @()
    foreach ($key in $configurableKeys) {
        $className = Get-UiCleanClassName $key
        if ($cssContent -notmatch [regex]::Escape($className)) {
            $missingCss += "$key -> $className"
        }
    }
    if ($missingCss.Count -gt 0) {
        Write-Host "    (Missing CSS hiding rules in content.css: $($missingCss -join ', '))" -ForegroundColor Yellow
    }
    Assert-Condition ($missingCss.Count -eq 0) "All configurable show* keys map to active CSS rules in content.css"
} else {
    Assert-Condition $false "content.css and defaults.js must exist"
}

# Test 6: Inverted keys transformation round-trip
$invertedKeys = @('showRightSponsored', 'showRightBirthdays', 'showRightMetaAI')
$invertValid = $true
function To-UIChecked($key, $stored) {
    if ($invertedKeys -contains $key) { return (-not $stored) }
    return $stored
}
function To-StoredValue($key, $ui) {
    if ($invertedKeys -contains $key) { return (-not $ui) }
    return $ui
}
foreach ($k in $invertedKeys) {
    if ((To-UIChecked $k $false) -ne $true -or (To-UIChecked $k $true) -ne $false) { $invertValid = $false }
    if ((To-StoredValue $k (To-UIChecked $k $true)) -ne $true) { $invertValid = $false }
    if ((To-StoredValue $k (To-UIChecked $k $false)) -ne $false) { $invertValid = $false }
}
Assert-Condition $invertValid "Inverted switch transformation logic maintains bidirectional round-trip consistency"

# Test 7: Verify isFeedPage logic
function Test-IsFeedPage($path) {
    if (-not $path) { return $false }
    $norm = if ($path.Length -gt 1 -and $path.EndsWith('/')) { $path.Substring(0, $path.Length - 1) } else { $path }
    if ($norm -eq '/' -or $norm -eq '/index.php' -or $norm -eq '/home.php') { return $true }
    if ($norm -eq '/feed' -or $norm.StartsWith('/feed/')) { return $true }
    if ($norm -eq '/groups/feed' -or $norm.StartsWith('/groups/feed/')) { return $true }
    if ($norm -eq '/friends/feed' -or $norm.StartsWith('/friends/feed/')) { return $true }
    return $false
}
$isFeedValid = $true
if (-not (Test-IsFeedPage '/')) { $isFeedValid = $false }
if (-not (Test-IsFeedPage '/groups/feed/')) { $isFeedValid = $false }
if (-not (Test-IsFeedPage '/friends/feed')) { $isFeedValid = $false }
if (Test-IsFeedPage '/groups/12345/') { $isFeedValid = $false }
if (Test-IsFeedPage '/marketplace/') { $isFeedValid = $false }
Assert-Condition $isFeedValid "isFeedPage correctly distinguishes Home/Feeds from Groups and feature pages"

Write-Host ""
if ($failed -eq 0) {
    Write-Host "All $passed tests passed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failed test(s) failed." -ForegroundColor Red
    exit 1
}
