@echo off
REM ============================================
REM  Update OpenTreeofLife Taxonomy Data Pipeline
REM ============================================
REM
REM Prerequisites:
REM   1. Download taxonomy.tsv from:
REM      https://tree.opentreeoflife.org/about/taxonomy-version
REM   2. Place taxonomy.tsv in data\opentree\
REM
REM This script will:
REM   1. Convert OpenTreeofLife taxonomy.tsv to nested tree (tree_opentree.json)
REM   2. Bake D3 circle-packing layout
REM   3. Split into multiple files for web loading
REM ============================================

cd /d "%~dp0.."
echo Current directory: %CD%
echo.

REM Install d3-hierarchy if not present
echo Checking dependencies...
call npm list d3-hierarchy >nul 2>&1
if errorlevel 1 (
    echo Installing d3-hierarchy...
    call npm install d3-hierarchy
)
echo.

REM Check if OpenTree file exists
if not exist "data\opentree\taxonomy.tsv" (
    echo ERROR: data\opentree\taxonomy.tsv not found!
    echo.
    echo Please download OpenTreeofLife taxonomy:
    echo   1. Go to: https://tree.opentreeoflife.org/about/taxonomy-version
    echo   2. Download: taxonomy.tsv
    echo   3. Place taxonomy.tsv in data\opentree\
    echo.
    pause
    exit /b 1
)

echo ============================================
echo Step 1: Converting OpenTreeofLife taxonomy.tsv to tree...
echo ============================================
node tools/convert-opentree-taxonomy-tsv-to-nested-tree-json.js
if errorlevel 1 (
    echo FAILED at Step 1
    pause
    exit /b 1
)
echo.

echo ============================================
echo Step 2: Baking D3 layout...
echo ============================================
echo (This may take several minutes for large datasets)
node tools/compute-d3-circle-packing-layout-from-opentree-tree.js
if errorlevel 1 (
    echo FAILED at Step 2
    pause
    exit /b 1
)
echo.

echo ============================================
echo COMPLETE!
echo ============================================
echo.
echo Your updated data files are in public\data\
echo You can now run: npm run dev
echo.
pause
