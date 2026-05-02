# AegisAI Automatic Database Update Setup Guide

## Overview
This guide will help you set up Windows Task Scheduler to automatically run `update_all.py` every 4 hours to keep your database current.

## Files Included
1. `run_update.bat` - Simple batch script
2. `run_update.ps1` - PowerShell script with logging (RECOMMENDED)
3. This setup guide

## Step 1: Customize the Script

### Option A: Using PowerShell Script (Recommended)
1. Open `run_update.ps1` in a text editor
2. Update these paths to match your system:
   ```powershell
   $ProjectPath = "C:\Users\YourUsername\path\to\AegisAI"
   $CondaPath = "C:\Users\YourUsername\Anaconda3"
   ```
   
3. If you use a specific conda environment, uncomment and customize:
   ```powershell
   # conda activate your_env_name
   ```

4. If your Groq API key isn't set in PowerShell profile, uncomment and add:
   ```powershell
   $env:GROQ_API_KEY = "your_groq_api_key_here"
   ```

5. Save the file to your AegisAI project folder

### Option B: Using Batch Script
1. Open `run_update.bat` in a text editor
2. Replace `C:\Users\YourUsername\path\to\AegisAI` with your actual project path
3. Replace the Anaconda path with your installation path
4. Save to your AegisAI project folder

## Step 2: Test the Script Manually

Before setting up the scheduler, test that the script works:

### For PowerShell script:
1. Right-click `run_update.ps1` → "Run with PowerShell"
2. Check that `update_log.txt` is created in your project folder
3. Verify the database was updated

### For Batch script:
1. Double-click `run_update.bat`
2. Watch for any errors in the command window

## Step 3: Set Up Windows Task Scheduler

1. **Open Task Scheduler**
   - Press `Win + R`
   - Type `taskschd.msc`
   - Press Enter

2. **Create a New Task**
   - In the right panel, click "Create Task..." (NOT "Create Basic Task")

3. **General Tab**
   - Name: `AegisAI Database Auto-Update`
   - Description: `Updates AegisAI database every 4 hours`
   - Select "Run whether user is logged on or not"
   - Check "Run with highest privileges"
   - Configure for: Windows 10/11

4. **Triggers Tab**
   - Click "New..."
   - Begin the task: "On a schedule"
   - Settings: "Daily"
   - Recur every: 1 days
   - Check "Repeat task every: 4 hours"
   - For a duration of: 1 day
   - Check "Enabled"
   - Click "OK"

5. **Actions Tab**
   - Click "New..."
   
   **For PowerShell script:**
   - Action: "Start a program"
   - Program/script: `powershell.exe`
   - Add arguments: `-ExecutionPolicy Bypass -File "C:\full\path\to\run_update.ps1"`
   - Start in: `C:\full\path\to\AegisAI` (your project folder)
   
   **For Batch script:**
   - Action: "Start a program"
   - Program/script: Browse to your `run_update.bat` file
   - Start in: Your AegisAI project folder path
   
   - Click "OK"

6. **Conditions Tab**
   - Uncheck "Start the task only if the computer is on AC power" (if on laptop)
   - Check "Wake the computer to run this task" (optional)

7. **Settings Tab**
   - Check "Allow task to be run on demand"
   - Check "Run task as soon as possible after a scheduled start is missed"
   - If the task fails, restart every: 10 minutes
   - Attempt to restart up to: 3 times
   - Check "Stop the task if it runs longer than: 1 hour"

8. **Save the Task**
   - Click "OK"
   - Enter your Windows password when prompted

## Step 4: Test the Scheduled Task

1. In Task Scheduler, find your "AegisAI Database Auto-Update" task
2. Right-click it → "Run"
3. Check the "Last Run Result" column (should show 0x0 for success)
4. Verify `update_log.txt` was updated with new timestamp
5. Check your database was updated

## Monitoring

### Check Logs
- PowerShell script creates `update_log.txt` in your project folder
- Review this file to see update history and any errors

### Check Task Status
- Open Task Scheduler
- Look at "Last Run Time" and "Last Run Result"
- 0x0 = Success
- Other codes = Error (check the log file)

## Troubleshooting

### Task doesn't run
- Verify the script paths are correct
- Check that Task Scheduler service is running
- Ensure your user has permissions to run scheduled tasks

### Script runs but database doesn't update
- Check `update_log.txt` for error messages
- Verify Python and all dependencies are installed
- Test running `update_all.py` manually in PyCharm
- Ensure Groq API key is accessible

### Permission errors
- Make sure "Run with highest privileges" is checked
- Verify the script has write access to the database file

## Modifying the Schedule

To change from 4 hours to a different interval:
1. Open Task Scheduler
2. Right-click your task → Properties
3. Go to Triggers tab
4. Edit the trigger
5. Change "Repeat task every" value
6. Click OK

## Disabling Auto-Updates

To temporarily stop auto-updates:
1. Open Task Scheduler
2. Right-click your task → Disable

To permanently remove:
1. Right-click your task → Delete

## Notes

- The task will run in the background even when PyCharm is closed
- Make sure your computer is on for updates to run (or enable "Wake computer")
- The first update will happen within 4 hours of creating the task
- Each update may take 1-5 minutes depending on API response times
- Check the log file weekly to ensure updates are running successfully
