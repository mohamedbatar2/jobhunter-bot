@echo off
title JobHunter AI - Dashboard & Bot
echo ====================================================
echo Starting JobHunter AI (Dashboard + Scraper/Bot)...
echo ====================================================
cd /d "%~dp0\scraper"

echo [1/2] Lancement du Scraper et Bot Telegram (index.js)...
start "JobHunter AI - Bot & Scraper" node index.js

echo [2/2] Lancement du Tableau de Bord (server.js)...
node server.js
pause

