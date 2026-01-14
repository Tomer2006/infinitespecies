@echo off
REM ============================================
REM  Update OpenTreeofLife Taxonomy Data Pipeline (Shallow First Sort)
REM ============================================
REM
REM Prerequisites:
REM   1. Download taxonomy.tsv from:
REM      https://tree.opentreeoflife.org/about/taxonomy-version
REM   2. Place taxonomy.tsv in data\opentree\
REM
REM This script will (optimized order for efficiency):
REM   1. Convert OpenTreeofLife taxonomy.tsv to nested tree (tree_opentree.json)
REM   2. Remove duplicate leaf nodes (reduces nodes early - efficient!)
REM   3. Remove sibling_higher nodes (reduces nodes early - efficient!)
REM   4. Lowercase all names in main tree (before expensive layout)
REM   5. Bake D3 circle-packing layout with Shallow First sorting (expensive operation)
REM   6. Capitalize names in split files (final formatting step)
REM
REM Shallow First sorting prioritizes higher taxonomic levels (kingdoms, phyla)
REM over deeper levels (species), making major groups more prominent.
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
echo Step 2: Removing duplicate leaf nodes...
echo ============================================
node tools/remove-duplicate-leaf-nodes-from-tree.js data/tree_opentree.json data/tree_opentree.json
if errorlevel 1 (
    echo FAILED at Step 2
    pause
    exit /b 1
)
echo.

echo ============================================
echo Step 3: Removing sibling_higher nodes...
echo ============================================
node tools/remove-sibling-higher-nodes-and-promote-children.js data/tree_opentree.json data/tree_opentree.json
if errorlevel 1 (
    echo FAILED at Step 3
    pause
    exit /b 1
)
echo.

echo ============================================
echo Step 4: Lowercasing all names in main tree...
echo ============================================
echo (Processing before layout for efficiency)
node tools/lowercase-all-names.js data/tree_opentree.json data/tree_opentree.json
if errorlevel 1 (
    echo FAILED at Step 4
    pause
    exit /b 1
)
echo.

echo ============================================
echo Step 5: Baking D3 layout (Shallow First sort)...
echo ============================================
echo (This may take several minutes for large datasets)
echo (Using Shallow First sorting - higher taxonomic levels prioritized)
node tools/compute-d3-circle-packing-layout-from-opentree-tree-shallow-first.js
if errorlevel 1 (
    echo FAILED at Step 5
    pause
    exit /b 1
)
echo.

echo ============================================
echo Step 6: Capitalizing names in split files...
echo ============================================
echo [1/5] Processing tree_part_001.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_001.json public/data/tree_part_001.json
if errorlevel 1 (
    echo FAILED at Step 6
    pause
    exit /b 1
)
echo [2/5] Processing tree_part_002.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_002.json public/data/tree_part_002.json
if errorlevel 1 (
    echo FAILED at Step 6
    pause
    exit /b 1
)
echo [3/5] Processing tree_part_003.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_003.json public/data/tree_part_003.json
if errorlevel 1 (
    echo FAILED at Step 6
    pause
    exit /b 1
)
echo [4/5] Processing tree_part_004.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_004.json public/data/tree_part_004.json
if errorlevel 1 (
    echo FAILED at Step 6
    pause
    exit /b 1
)
echo [5/5] Processing tree_part_005.json...
node tools/capitalize-first-letter-of-each-word-in-names.js public/data/tree_part_005.json public/data/tree_part_005.json
if errorlevel 1 (
    echo FAILED at Step 6
    pause
    exit /b 1
)
echo.

echo ============================================
echo COMPLETE!
echo ============================================
echo.
echo Your updated data files are in public\data\
echo Layout uses Shallow First sorting (higher taxonomic levels prioritized)
echo You can now run: npm run dev
echo.
pause
