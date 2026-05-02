@echo off
REM AegisAI Database Auto-Update Script
REM This script is called by Windows Task Scheduler every 4 hours

REM Change to the AegisAI project directory
cd /d "C:\Users\Tesnim\PycharmProjects\AegisAI"

REM Activate the Anaconda environment (adjust the path to your conda installation)
call C:\Users\Tesnim\anaconda3\Scripts\activate.bat

REM Activate your specific environment (if you're using one)
REM call conda activate your_env_name

REM Run the update script
python update_all.py

REM Log the completion with timestamp
echo Database updated at %date% %time% >> update_log.txt

REM Exit
exit
