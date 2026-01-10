@echo off
REM Change to the project root directory (parent of tools folder)
cd /d "%~dp0.."

echo Capitalizing names in all tree files...
echo Current directory: %CD%
echo.

echo [1/5] Processing tree_part_001.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_001.json public/data/tree_part_001.json
echo.

echo [2/5] Processing tree_part_002.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_002.json public/data/tree_part_002.json
echo.

echo [3/5] Processing tree_part_003.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_003.json public/data/tree_part_003.json
echo.

echo [4/5] Processing tree_part_004.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_004.json public/data/tree_part_004.json
echo.

echo [5/5] Processing tree_part_005.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_005.json public/data/tree_part_005.json
echo.

echo ========================================
echo All files processed!
echo ========================================
pause
