# Konecta WFM - Frontend Setup Script
# Run this in PowerShell AFTER closing Cursor/VS Code to avoid file locks

$ErrorActionPreference = "Stop"
$frontendPath = $PSScriptRoot

Write-Host "=== Konecta WFM Frontend Setup ===" -ForegroundColor Cyan
Write-Host ""

function Remove-FolderForce($path) {
    if (-not (Test-Path $path)) { return }

    # Kill common processes that lock node_modules on Windows
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    try {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
        return
    } catch {
        # Fallback 1: cmd rmdir
        cmd /c "rmdir /s /q `"$path`"" | Out-Null
        if (-not (Test-Path $path)) { return }

        # Fallback 2: robocopy mirror-empty trick
        $empty = Join-Path $env:TEMP ("empty_" + [Guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Path $empty | Out-Null
        robocopy $empty $path /MIR /NFL /NDL /NJH /NJS | Out-Null
        Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
        cmd /c "rmdir /s /q `"$path`"" | Out-Null
    }
}

# Step 1: Remove old artifacts
Write-Host "[1/4] Removing node_modules, .next, package-lock.json..." -ForegroundColor Yellow
Set-Location $frontendPath
if (Test-Path node_modules) {
    Remove-FolderForce "node_modules"
    Write-Host "  - Removed node_modules" -ForegroundColor Gray
}
if (Test-Path .next) {
    Remove-FolderForce ".next"
    Write-Host "  - Removed .next" -ForegroundColor Gray
}
if (Test-Path package-lock.json) {
    Remove-Item -Force package-lock.json
    Write-Host "  - Removed package-lock.json" -ForegroundColor Gray
}
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 2: Clear npm cache
Write-Host "[2/4] Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force 2>$null
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 3: Fresh install
Write-Host "[3/4] Running npm install (this may take 2-5 minutes)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  npm install failed. Try:" -ForegroundColor Red
    Write-Host "  1. Close Cursor completely, then run this script again" -ForegroundColor Red
    Write-Host "  2. Or run: npm install --legacy-peer-deps" -ForegroundColor Red
    exit 1
}
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 4: Ready
Write-Host "[4/4] Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Start the dev server with: npm run dev" -ForegroundColor Cyan
Write-Host "Then open: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
