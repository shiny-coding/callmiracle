#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { shutdownDevServer } = require('./dev-utils');

// Debug logging function
function debugLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Log to console
  console.log(message);
  
  // Log to file
  try {
    const logPath = path.join(__dirname, '..', 'logs', 'shutdown-debug.log');
    fs.appendFileSync(logPath, logMessage);
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

async function main() {
  const targetPid = process.argv[2];
  const port = process.env.PORT || 3003;
  
  debugLog('🛑 Starting shutdown process...');
  debugLog(`Script started with PID argument: ${targetPid}`);
  debugLog(`PORT from env: ${port}`);
  
  // Use the utility function for complete shutdown
  await shutdownDevServer({
    nextjsPid: targetPid,
    port: parseInt(port),
    verbose: true // This will use console.log, but we'll also log via debugLog
  });
  
  debugLog('✅ Shutdown complete');
  process.exit(0);
}

main().catch((error) => {
  debugLog(`Shutdown script error: ${error.message}`);
  process.exit(1);
});