@echo off
REM ============================================
REM  Update NCBI Taxonomy Data Pipeline
REM ============================================
REM
REM Prerequisites:
REM   1. Download taxdump.tar.gz from:
REM      https://ftp.ncbi.nlm.nih.gov/pub/taxonomy/taxdump.tar.gz
REM   2. Extract and place nodes.dmp and names.dmp in data\ncbi\
REM
REM This script will:
REM   1. Convert NCBI dump to nested tree (tree_ncbi.json)
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

REM Check if NCBI files exist
if not exist "data\ncbi\nodes.dmp" (
    echo ERROR: data\ncbi\nodes.dmp not found!
    echo.
    echo Please download NCBI taxonomy dump:
    echo   1. Go to: https://ftp.ncbi.nlm.nih.gov/pub/taxonomy/
    echo   2. Download: taxdump.tar.gz
    echo   3. Extract and copy nodes.dmp and names.dmp to data\ncbi\
    echo.
    pause
    exit /b 1
)

if not exist "data\ncbi\names.dmp" (
    echo ERROR: data\ncbi\names.dmp not found!
    pause
    exit /b 1
)

echo ============================================
echo Step 1: Converting NCBI dump to tree...
echo ============================================
node tools/convert-ncbi-taxonomy-dump-to-nested-tree-json.js
if errorlevel 1 (
    echo FAILED at Step 1
    pause
    exit /b 1
)
echo.

echo ============================================
echo Step 2: Baking D3 layout...
echo ============================================
echo (This may take several minutes for 2+ million nodes)
node tools/compute-d3-circle-packing-layout-from-ncbi-tree.js
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
