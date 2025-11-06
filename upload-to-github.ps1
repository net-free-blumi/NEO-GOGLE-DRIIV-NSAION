# Git Upload Script for NEO-GOGLE-DRIIV-NSAION
$ErrorActionPreference = "Continue"
$remoteUrl = "https://github.com/net-free-blumi/NEO-GOGLE-DRIIV-NSAION.git"

Write-Host "=== Git Upload Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to initialize git repository" -ForegroundColor Red
        exit 1
    }
}

# Configure git safe directory (if needed)
Write-Host "Configuring git..." -ForegroundColor Yellow
$currentDir = (Get-Location).Path
git config --global --add safe.directory $currentDir 2>$null

# Add remote if not exists
Write-Host "Checking remote..." -ForegroundColor Yellow
$remotes = git remote 2>&1
if ($remotes -notmatch "origin") {
    Write-Host "Adding remote origin..." -ForegroundColor Yellow
    git remote add origin $remoteUrl
} else {
    Write-Host "Updating remote origin URL..." -ForegroundColor Yellow
    git remote set-url origin $remoteUrl
}

# Check current branch
Write-Host "Checking branch..." -ForegroundColor Yellow
$currentBranch = git branch --show-current 2>&1
if ($null -eq $currentBranch -or $currentBranch -eq "") {
    Write-Host "Creating main branch..." -ForegroundColor Yellow
    git checkout -b main 2>&1 | Out-Null
} else {
    Write-Host "Current branch: $currentBranch" -ForegroundColor Green
    if ($currentBranch -ne "main") {
        git branch -M main 2>&1 | Out-Null
    }
}

# Add all files
Write-Host ""
Write-Host "Adding all files..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to add files" -ForegroundColor Red
    exit 1
}

# Check if there are changes to commit
Write-Host "Checking for changes..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "Committing changes..." -ForegroundColor Yellow
    $commitMessage = "Update: Add email authentication, grid/list view toggle, refresh button, and album art support"
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to commit changes" -ForegroundColor Red
        exit 1
    }
    Write-Host "Changes committed successfully!" -ForegroundColor Green
} else {
    Write-Host "No changes to commit" -ForegroundColor Yellow
}

# Push to main branch
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push to GitHub. You may need to authenticate." -ForegroundColor Red
    Write-Host "Please run: git push -u origin main --force" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Repository uploaded to: $remoteUrl" -ForegroundColor Cyan

