@echo off
echo Starting Redis Pub/Sub Performance Test
echo ========================================
cd /d "%~dp0\.."
node scripts\test-redis-pubsub.js %*