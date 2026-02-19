#!/usr/bin/env pwsh
<#
  deploy.ps1 — Deploy the 2nd Year Nursing Quiz to Vercel
  
  Prerequisites:
    1. Node.js 18+ installed
    2. Vercel CLI: npm i -g vercel
    3. A Supabase project with the migrations applied (see SETUP.md)
    4. A Vercel account (free tier works)

  Usage:
    .\deploy.ps1                  # Interactive deployment (first time)
    .\deploy.ps1 -Production      # Deploy to production
#>

param(
  [switch]$Production
)

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  2nd Year Nursing Quiz — Vercel Deploy" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

# 1. Check Vercel CLI
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Host "[!] Vercel CLI not found. Installing globally..." -ForegroundColor Yellow
  npm install -g vercel
}

# 2. Check .env.local exists and warn if not
$envFile = Join-Path $projectDir ".env.local"
if (-not (Test-Path $envFile)) {
  Write-Host "[!] No .env.local file found." -ForegroundColor Yellow
  Write-Host "    The app will work with localStorage only (no Supabase)." -ForegroundColor Yellow
  Write-Host "    For Supabase, create .env.local from .env.example first." -ForegroundColor Yellow
  Write-Host ""
}

# 3. Install dependencies
Write-Host "[1/4] Installing dependencies..." -ForegroundColor Cyan
Push-Location $projectDir
npm ci --prefer-offline 2>$null || npm install
Pop-Location

# 4. Build locally to verify
Write-Host "[2/4] Building project..." -ForegroundColor Cyan
Push-Location $projectDir
npm run build
Pop-Location

Write-Host "[3/4] Build successful!" -ForegroundColor Green

# 5. Deploy
Write-Host "[4/4] Deploying to Vercel..." -ForegroundColor Cyan
Push-Location $projectDir

if ($Production) {
  Write-Host "  -> Production deployment" -ForegroundColor Magenta
  vercel --prod
} else {
  Write-Host "  -> Preview deployment (use -Production flag for production)" -ForegroundColor Yellow
  vercel
}

Pop-Location

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Set these environment variables in the Vercel dashboard:" -ForegroundColor Yellow
Write-Host "  - NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor White
Write-Host "  - NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor White
Write-Host "  - SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor White
Write-Host "  - ADMIN_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "Go to: https://vercel.com -> Your Project -> Settings -> Environment Variables"
Write-Host ""
