@echo off
REM AegisAI Database Auto-Update Script
REM ============================================

REM Set UTF-8 encoding to handle any special characters
chcp 65001 >nul 2>&1

REM Get the directory where this script is located
cd /d "%~dp0"

REM Log start time
echo ================================== >> update_log.txt
echo Update started at %date% %time% >> update_log.txt

REM Set the Groq API key if needed
REM Uncomment the line below and add your key if it's not set globally
REM set GROQ_API_KEY=your_groq_api_key_here

REM Set Python to use UTF-8 encoding
set PYTHONIOENCODING=utf-8

REM Run the Python update script
echo Running update_all.py... >> update_log.txt
python update_all.py >> update_log.txt 2>&1

REM Check if it succeeded
if %ERRORLEVEL% EQU 0 (
    echo Update completed successfully at %date% %time% >> update_log.txt
) else (
    echo Update FAILED with error code %ERRORLEVEL% at %date% %time% >> update_log.txt
)

echo ================================== >> update_log.txt
echo.

exit /b %ERRORLEVEL%
