# This script fixes the emoji encoding issue in update_all.py
# Run this once to fix the problem

import sys

# Read the original file
with open('update_all.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace emojis with simple text
replacements = {
    '📥': '[↓]',
    '📊': '[DATA]',
    '🤖': '[AI]',
    '✅': '[OK]',
    '❌': '[X]',
    '⚠️': '[!]',
    '🔄': '[~]',
    '📈': '[↑]',
    '💾': '[SAVE]',
    '🎯': '[*]',
}

for emoji, replacement in replacements.items():
    content = content.replace(emoji, replacement)

# Write back
with open('update_all.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Fixed update_all.py - emojis replaced with ASCII symbols")
print("You can now run update_all.py from PowerShell or Task Scheduler")
