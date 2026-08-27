@echo off
chcp 65001 > nul
title Synchronisation Bancaire - Sousous

echo ========================================================
echo   SOUSOUS - Synchronisation des Comptes Bancaires
echo ========================================================
echo.
echo Connexion au connecteur Woob et mise a jour de Supabase...
echo.

cd /d "c:\Users\marti\Desktop\Projets\Sousous"
node scripts/sync_banking_to_db.mjs

echo.
echo ========================================================
echo Synchronisation terminee. Vous pouvez fermer cette fenetre.
echo ========================================================
echo.
pause
