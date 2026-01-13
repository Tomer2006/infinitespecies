@echo off
REM ============================================
REM  Convert OpenTreeofLife Taxonomy with Common Names
REM ============================================
REM
REM Prerequisites:
REM   1. Download taxonomy.tsv from:
REM      https://tree.opentreeoflife.org/about/taxonomy-version
REM   2. (Optional) Download synonyms.tsv from the same page for common names
REM   3. Place both files in data\opentree\
REM
REM This script will:
REM   1. Convert OpenTreeofLife taxonomy.tsv to nested tree (tree_opentree.json)
REM   2. Parse synonyms.tsv to extract common names
REM   3. Combine common names with scientific names: "Common Name (Scientific Name)"
REM ============================================

cd /d "%~dp0.."
echo Current directory: %CD%
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

REM Check if synonyms file exists (optional)
if not exist "data\opentree\synonyms.tsv" (
    echo WARNING: data\opentree\synonyms.tsv not found!
    echo.
    echo Common names will not be included.
    echo To include common names:
    echo   1. Go to: https://tree.opentreeoflife.org/about/taxonomy-version
    echo   2. Download: synonyms.tsv
    echo   3. Place synonyms.tsv in data\opentree\
    echo.
    echo Continuing without common names...
    echo.
    timeout /t 3 >nul
)

echo ============================================
echo Converting OpenTreeofLife taxonomy with common names...
echo ============================================
node tools/convert-opentree-taxonomy-tsv-to-nested-tree-json.js
if errorlevel 1 (
    echo FAILED: Conversion failed
    pause
    exit /b 1
)
echo.

echo ============================================
echo COMPLETE!
echo ============================================
echo.
echo Output file: data\tree_opentree.json
echo.
echo Names are formatted as: "Common Name (Scientific Name)"
echo If no common name exists, only the scientific name is shown.
echo.
pause
