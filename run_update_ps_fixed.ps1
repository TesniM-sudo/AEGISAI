# AegisAI Database Auto-Update Script (PowerShell) - FIXED
# This script handles UTF-8 encoding properly

# Set UTF-8 encoding for PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Set error action preference
$ErrorActionPreference = "Continue"

# Define paths - CUSTOMIZE THESE FOR YOUR SYSTEM
$ProjectPath = "C:\Users\Tesnim\PycharmProjects\AegisAI"
$LogFile = Join-Path $ProjectPath "update_log.txt"

# Function to write logs
function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "$timestamp - $Message"
    Add-Content -Path $LogFile -Value $logEntry -Encoding UTF8
    Write-Host $logEntry
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

# Set Groq API key if needed
# Uncomment and customize if your key isn't set globally:
# $env:GROQ_API_KEY = "your_groq_api_key_here"

# Set Python to use UTF-8 encoding
$env:PYTHONIOENCODING = "utf-8"

# Run the update script
try {
    Write-Log "Running update_all.py..."
    
    # Run the update script and capture output
    $output = & python update_all.py 2>&1 | Out-String
    
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
