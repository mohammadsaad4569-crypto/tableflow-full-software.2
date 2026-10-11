@echo off
setlocal
echo.
echo  TABLEFLOW - FULL SOFTWARE SETUP
echo  ===============================
echo.
where node >nul 2>nul || (echo Node.js 20+ is required.&pause&exit /b 1)
where npm >nul 2>nul || (echo npm is required.&pause&exit /b 1)
where docker >nul 2>nul || (echo Docker Desktop is required for the local database.&pause&exit /b 1)

if not exist server\.env (
  copy server\.env.example server\.env >nul
  echo Created server\.env
)

echo Installing root tools...
call npm install
if errorlevel 1 goto fail

echo Installing server...
call npm install --prefix server
if errorlevel 1 goto fail

echo Installing client...
call npm install --prefix client
if errorlevel 1 goto fail

echo Starting PostgreSQL...
call docker compose up -d db
if errorlevel 1 goto fail

echo Syncing database...
call npm run db:push
if errorlevel 1 goto fail

echo Seeding demo restaurant...
call npm run db:seed
if errorlevel 1 goto fail

echo.
echo Setup complete.
echo Run START_WINDOWS.bat to launch TableFlow.
pause
exit /b 0

:fail
echo.
echo Setup failed. Read the error above.
pause
exit /b 1
