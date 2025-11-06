# Git Upload Script - Run this from the project directory
# Usage: .\git-upload-all.ps1

$ErrorActionPreference = "Continue"
$remoteUrl = "https://github.com/net-free-blumi/NEO-GOGLE-DRIIV-NSAION.git"

Write-Host "=== Git Upload Script ===" -ForegroundColor Cyan
Write-Host ""

# Configure git safe directory
Write-Host "Configuring git safe directory..." -ForegroundColor Yellow
git config --global --add safe.directory "*" 2>$null

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to initialize git repository" -ForegroundColor Red
        exit 1
    }
}

# Add remote if not exists
Write-Host "Checking remote..." -ForegroundColor Yellow
$remotes = git remote 2>&1 | Out-String
if ($remotes -notmatch "origin") {
    Write-Host "Adding remote origin..." -ForegroundColor Yellow
    git remote add origin $remoteUrl
} else {
    Write-Host "Updating remote origin URL..." -ForegroundColor Yellow
    git remote set-url origin $remoteUrl
}

# Check current branch
Write-Host "Checking branch..." -ForegroundColor Yellow
$currentBranch = git branch --show-current 2>&1 | Out-String
$currentBranch = $currentBranch.Trim()
if ([string]::IsNullOrEmpty($currentBranch)) {
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
$status = git status --porcelain 2>&1 | Out-String
if ($status.Trim()) {
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
Write-Host "Note: You may need to authenticate with GitHub" -ForegroundColor Yellow
git push -u origin main --force
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Push failed. This might be due to:" -ForegroundColor Red
    Write-Host "1. Authentication required - run: git push -u origin main --force" -ForegroundColor Yellow
    Write-Host "2. Or use GitHub Desktop / Git Credential Manager" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Repository uploaded to: $remoteUrl" -ForegroundColor Cyan

