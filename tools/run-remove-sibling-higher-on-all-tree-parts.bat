@echo off
REM ============================================================
REM  Remove "sibling_higher" Nodes and Promote Their Children
REM ============================================================
REM
REM This script processes all tree_part_*.json files and:
REM   - Finds nodes named "sibling_higher"
REM   - Re-parents their children to the grandparent
REM   - Removes the sibling_higher nodes
REM
REM ============================================================

cd /d "%~dp0.."

echo ============================================================
echo  Remove sibling_higher Nodes - Processing All Tree Parts
echo ============================================================
echo.
echo Current directory: %CD%
echo.

REM Check if data files exist
if not exist "public\data\tree_part_001.json" (
    echo ERROR: public\data\tree_part_001.json not found!
    echo Make sure your data files are in public\data\
    pause
    exit /b 1
)

set ERRORS=0

echo [1/5] Processing tree_part_001.json...
node tools/remove-sibling-higher-nodes-and-promote-children.js public/data/tree_part_001.json public/data/tree_part_001.json
if errorlevel 1 set /a ERRORS+=1
echo.

echo [2/5] Processing tree_part_002.json...
node tools/remove-sibling-higher-nodes-and-promote-children.js public/data/tree_part_002.json public/data/tree_part_002.json
if errorlevel 1 set /a ERRORS+=1
echo.

echo [3/5] Processing tree_part_003.json...
node tools/remove-sibling-higher-nodes-and-promote-children.js public/data/tree_part_003.json public/data/tree_part_003.json
if errorlevel 1 set /a ERRORS+=1
echo.

echo [4/5] Processing tree_part_004.json...
node tools/remove-sibling-higher-nodes-and-promote-children.js public/data/tree_part_004.json public/data/tree_part_004.json
if errorlevel 1 set /a ERRORS+=1
echo.

echo [5/5] Processing tree_part_005.json...
node tools/remove-sibling-higher-nodes-and-promote-children.js public/data/tree_part_005.json public/data/tree_part_005.json
if errorlevel 1 set /a ERRORS+=1
echo.

echo ============================================================
if %ERRORS% EQU 0 (
    echo  SUCCESS! All 5 files processed successfully.
) else (
    echo  COMPLETED with %ERRORS% error(s).
)
echo ============================================================
echo.
pause
