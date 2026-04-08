@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Usage:
REM   collect-code-context.bat
REM   collect-code-context.bat my-output-folder

set "ROOT=%~dp0"
set "OUT_DIR=%~1"
if "%OUT_DIR%"=="" set "OUT_DIR=test"

set "ABS_OUT=%OUT_DIR%"
if not "%OUT_DIR:~1,1%"==":" set "ABS_OUT=%ROOT%%OUT_DIR%"
if not exist "%ABS_OUT%" mkdir "%ABS_OUT%"

set "BACKEND_ROOT=%ROOT%Project\electro"
set "FRONTEND_ROOT=%ROOT%electro-frontend"

call :CollectProject "backend" "%BACKEND_ROOT%"
if errorlevel 1 exit /b 1

call :CollectProject "frontend" "%FRONTEND_ROOT%"
if errorlevel 1 exit /b 1

echo.
echo Ready.
echo Output folder: "%ABS_OUT%"
echo Files:
echo   - backend-tree.txt
echo   - backend-code.txt
echo   - frontend-tree.txt
echo   - frontend-code.txt
exit /b 0

:CollectProject
set "PROJECT_NAME=%~1"
set "PROJECT_PATH=%~2"
set "TREE_FILE=%ABS_OUT%\%PROJECT_NAME%-tree.txt"
set "CODE_FILE=%ABS_OUT%\%PROJECT_NAME%-code.txt"

if not exist "%PROJECT_PATH%" (
  echo SKIP: project folder not found: "%PROJECT_PATH%"
  exit /b 0
)

echo Project: %PROJECT_PATH%>"%TREE_FILE%"
echo.>>"%TREE_FILE%"
echo Project: %PROJECT_PATH%>"%CODE_FILE%"
echo.>>"%CODE_FILE%"

set /a FILE_COUNT=0

for /r "%PROJECT_PATH%" %%F in (*) do (
  set "FULL=%%~fF"
  set "EXT=%%~xF"

  call :ShouldSkip "!FULL!"
  if !errorlevel! equ 1 (
    rem skip file
  ) else (
  call :IsIncludedFile "!FULL!"
    if !errorlevel! equ 0 (
      set /a FILE_COUNT+=1
      set "REL=!FULL:%PROJECT_PATH%\=!"
      echo !REL!>>"%TREE_FILE%"

      >>"%CODE_FILE%" echo ============================================================
      >>"%CODE_FILE%" echo FILE: !REL!
      >>"%CODE_FILE%" echo ============================================================
      type "%%~fF">>"%CODE_FILE%"
      >>"%CODE_FILE%" echo.
      >>"%CODE_FILE%" echo.
    )
  )
)

powershell -NoProfile -Command "(Get-Content -LiteralPath '%TREE_FILE%' -Raw) | Set-Content -LiteralPath '%TREE_FILE%' -Encoding UTF8"
powershell -NoProfile -Command "(Get-Content -LiteralPath '%CODE_FILE%' -Raw) | Set-Content -LiteralPath '%CODE_FILE%' -Encoding UTF8"
powershell -NoProfile -Command "(Get-Content -LiteralPath '%TREE_FILE%' -Raw) -replace 'Project: .*?\r?\n\r?\n', ('Project: %PROJECT_PATH%' + [Environment]::NewLine + [Environment]::NewLine + 'Files count: %FILE_COUNT%' + [Environment]::NewLine) | Set-Content -LiteralPath '%TREE_FILE%' -Encoding UTF8"

echo Done: %PROJECT_NAME% - %FILE_COUNT% files
exit /b 0

:ShouldSkip
set "P=%~1"
echo %~1 | findstr /I /C:"\.git\" /C:"\node_modules\" /C:"\target\" /C:"\build\" /C:"\dist\" /C:"\out\" /C:"\coverage\" /C:"\.idea\" /C:"\.vscode\" >nul
if not errorlevel 1 exit /b 1
exit /b 0

:IsIncludedFile
set "F=%~1"
set "E=%~x1"
set "N=%~nx1"
if /I "%N%"=="Dockerfile" exit /b 0
if /I "%E%"==".java" exit /b 0
if /I "%E%"==".kt" exit /b 0
if /I "%E%"==".kts" exit /b 0
if /I "%E%"==".gradle" exit /b 0
if /I "%E%"==".xml" exit /b 0
if /I "%E%"==".yml" exit /b 0
if /I "%E%"==".yaml" exit /b 0
if /I "%E%"==".properties" exit /b 0
if /I "%E%"==".sql" exit /b 0
if /I "%E%"==".js" exit /b 0
if /I "%E%"==".jsx" exit /b 0
if /I "%E%"==".ts" exit /b 0
if /I "%E%"==".tsx" exit /b 0
if /I "%E%"==".css" exit /b 0
if /I "%E%"==".scss" exit /b 0
if /I "%E%"==".html" exit /b 0
if /I "%E%"==".json" exit /b 0
if /I "%E%"==".md" exit /b 0
if /I "%E%"==".txt" exit /b 0
if /I "%E%"==".sh" exit /b 0
if /I "%E%"==".bat" exit /b 0
if /I "%E%"==".cmd" exit /b 0
if /I "%E%"==".ps1" exit /b 0
if /I "%E%"==".dockerfile" exit /b 0
exit /b 1
