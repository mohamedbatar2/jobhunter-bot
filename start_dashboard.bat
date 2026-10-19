@echo off
title JobHunter AI - Dashboard Server
echo ====================================================
echo Starting JobHunter AI Dashboard Server...
echo ====================================================
cd /d "%~dp0\scraper"
npm run dashboard
pause
