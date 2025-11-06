# Git Upload Script
$repoPath = Get-Location
$remoteUrl = "https://github.com/net-free-blumi/NEO-GOGLE-DRIIV-NSAION.git"

Write-Host "Current directory: $repoPath"

# Initialize git if needed
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..."
    git init
}

# Add remote if not exists
$remotes = git remote 2>$null
if ($null -eq $remotes -or $remotes -notcontains "origin") {
    Write-Host "Adding remote origin..."
    git remote add origin $remoteUrl
} else {
    Write-Host "Setting remote origin URL..."
    git remote set-url origin $remoteUrl
}

# Check current branch
$currentBranch = git branch --show-current 2>$null
if ($null -eq $currentBranch) {
    Write-Host "Creating main branch..."
    git checkout -b main
} else {
    Write-Host "Current branch: $currentBranch"
    if ($currentBranch -ne "main") {
        git checkout -b main 2>$null
        git branch -M main
    }
}

# Add all files
Write-Host "Adding all files..."
git add .

# Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    Write-Host "Committing changes..."
    git commit -m "Update: Add email authentication, grid/list view toggle, refresh button, and album art support"
} else {
    Write-Host "No changes to commit"
}

# Push to main branch
Write-Host "Pushing to GitHub..."
git push -u origin main --force

Write-Host "Done!"

