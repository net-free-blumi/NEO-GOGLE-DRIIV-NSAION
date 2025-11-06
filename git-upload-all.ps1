# Git Upload Script - Upload all code to GitHub
# This script will upload all code to GitHub, even if it already exists

$repoPath = Get-Location
$remoteUrl = "https://github.com/net-free-blumi/NEO-GOGLE-DRIIV-NSAION.git"

Write-Host "========================================="
Write-Host "Git Upload Script"
Write-Host "========================================="
Write-Host "Current directory: $repoPath"
Write-Host "Remote URL: $remoteUrl"
Write-Host ""

# Initialize git if needed
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..."
    git init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to initialize git repository" -ForegroundColor Red
        exit 1
    }
}

# Add remote if not exists
$remotes = git remote 2>$null
if ($null -eq $remotes -or $remotes -notcontains "origin") {
    Write-Host "Adding remote origin..."
    git remote add origin $remoteUrl
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to add remote" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Setting remote origin URL..."
    git remote set-url origin $remoteUrl
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to set remote URL" -ForegroundColor Red
        exit 1
    }
}

# Check current branch
$currentBranch = git branch --show-current 2>$null
if ($null -eq $currentBranch) {
    Write-Host "Creating main branch..."
    git checkout -b main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to create main branch" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Current branch: $currentBranch"
    if ($currentBranch -ne "main") {
        Write-Host "Switching to main branch..."
        git checkout -b main 2>$null
        git branch -M main
    }
}

# Add all files
Write-Host ""
Write-Host "Adding all files..."
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to add files" -ForegroundColor Red
    exit 1
}

# Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    Write-Host "Committing changes..."
    git commit -m "Update: Fix audio playback, improve folder navigation, and enhance UI"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to commit changes" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "No changes to commit"
}

# Push to main branch (force push to overwrite)
Write-Host ""
Write-Host "Pushing to GitHub (main branch)..."
Write-Host "This will overwrite any existing code on GitHub"
git push -u origin main --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to push to GitHub" -ForegroundColor Red
    Write-Host "You may need to authenticate. Try running:" -ForegroundColor Yellow
    Write-Host "  git push -u origin main --force" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================="
Write-Host "Done! All code has been uploaded to GitHub" -ForegroundColor Green
Write-Host "Repository: $remoteUrl" -ForegroundColor Green
Write-Host "========================================="
