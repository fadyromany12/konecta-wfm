@echo off
REM Run migrations_extra.sql using PostgreSQL psql.
REM Uses full path so psql does not need to be in PATH.
REM You will be prompted for the database user password (see backend .env DATABASE_URL).

"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U konecta -d konecta_wfm -f "%~dp0sql\migrations_extra.sql"
pause
