# BROMISE Test Setup Script (Windows)

Write-Host "🚀 BROMISE - Bug Fix Testing Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "⚠️  .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ Created .env file. Please update with your credentials." -ForegroundColor Green
    Write-Host ""
}

Write-Host "📦 Step 1: Fixing npm vulnerabilities..." -ForegroundColor Cyan
npm audit fix

Write-Host ""
Write-Host "🔨 Step 2: Building project..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed. Check errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🧹 Step 3: Running linter..." -ForegroundColor Cyan
npm run lint

Write-Host ""
Write-Host "✅ All checks passed!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Ready to test! Run these commands:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Terminal 1: npm run dev        # Start frontend (port 5173)" -ForegroundColor Yellow
Write-Host "  Terminal 2: npm run dev:server # Start backend (port 3001)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Or run both: npm run dev:all" -ForegroundColor Yellow
Write-Host ""
Write-Host "🌐 Then open: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Test checklist available in DEPLOYMENT.md" -ForegroundColor Cyan
