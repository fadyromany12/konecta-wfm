@echo off
REM Run full DB setup: schema + seed + migrations_extra
REM Set DB user and DB name below, or pass as env. You will be prompted for password.

set PSQL="C:\Program Files\PostgreSQL\18\bin\psql.exe"
set DBUSER=konecta
set DBNAME=konecta_wfm

if not exist %PSQL% (
  echo psql not found at %PSQL%. Edit this script to match your PostgreSQL path.
  pause
  exit /b 1
)

echo Running schema.sql...
%PSQL% -U %DBUSER% -d %DBNAME% -f "%~dp0schema.sql"
if errorlevel 1 (echo Schema failed.; pause & exit /b 1)

echo Running seed.sql...
%PSQL% -U %DBUSER% -d %DBNAME% -f "%~dp0seed.sql"
if errorlevel 1 (echo Seed failed.; pause & exit /b 1)

echo Running migrations_extra.sql...
%PSQL% -U %DBUSER% -d %DBNAME% -f "%~dp0sql\migrations_extra.sql"
if errorlevel 1 (echo Migrations failed.; pause & exit /b 1)

echo.
echo DB setup complete. Credentials: admin@konecta.com / manager@konecta.com / test.agent@konecta.com — Password1
pause
