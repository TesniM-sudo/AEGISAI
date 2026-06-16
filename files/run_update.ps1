# AegisAI Database Auto-Update Script (PowerShell)
# This script is called by Windows Task Scheduler every 4 hours

# Set error action preference
$ErrorActionPreference = "Continue"

# Define paths - CUSTOMIZE THESE FOR YOUR SYSTEM
$ProjectPath = "C:\Users\Tesnim\PycharmProjects\AegisAI"
$CondaPath = "C:\Users\Tesnim\anaconda3"
$LogFile = Join-Path $ProjectPath "update_log.txt"

# Function to write logs
function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LogFile -Append
    Write-Host "$timestamp - $Message"
}

Write-Log "=== Starting database update ==="

# Change to project directory
try {
    Set-Location $ProjectPath
    Write-Log "Changed to project directory: $ProjectPath"
} catch {
    Write-Log "ERROR: Could not change to project directory - $_"
    exit 1
}

# Set GROQ_API_KEY (optional).
# Prefer setting it once in your user environment instead of hardcoding secrets in scripts:
#   [System.Environment]::SetEnvironmentVariable("GROQ_API_KEY", "your_key_here", "User")
# Or uncomment the next line for local-only use:
# $env:GROQ_API_KEY = "your_groq_api_key_here"

# Activate Anaconda and run update
try {
    # Initialize Anaconda
    & "$CondaPath\Scripts\activate.bat"
    
    # If you have a specific conda environment, uncomment and customize:
    # conda activate your_env_name
    
    Write-Log "Running update_all.py..."
    
    # Run the update script and capture output
    $output = python update_all.py 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Database update completed successfully"
        Write-Log "Output: $output"
    } else {
        Write-Log "ERROR: update_all.py failed with exit code $LASTEXITCODE"
        Write-Log "Output: $output"
    }
    
} catch {
    Write-Log "ERROR: Exception occurred - $_"
    exit 1
}

Write-Log "=== Database update finished ==="
