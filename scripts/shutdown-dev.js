#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

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

const PORT = process.env.PORT || 3003;
const DEBUG_PORTS = [9229, 9230, 9231, 9232];

// Kill process using the specified port
async function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      // Find the process using the port - look for LISTENING state
      const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
      const lines = stdout.trim().split('\n').filter(line => line.includes('LISTENING'));
      
      if (lines.length === 0) {
        debugLog(`No processes found listening on port ${port}`);
        return;
      }
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        
        if (pid && pid !== '0' && !isNaN(pid)) {
          try {
            debugLog(`🎯 Killing process ${pid} using port ${port}...`);
            await execAsync(`taskkill /F /PID ${pid}`);
            debugLog(`✅ Successfully killed process ${pid}`);
          } catch (err) {
            debugLog(`⚠️ Failed to kill process ${pid}: ${err.message}`);
          }
        }
      }
    } else {
      // For Unix-like systems
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        
        if (pids.length === 0) {
          debugLog(`No processes found using port ${port}`);
          return;
        }
        
        for (const pid of pids) {
          debugLog(`🎯 Killing process ${pid} using port ${port}...`);
          await execAsync(`kill -9 ${pid}`);
          debugLog(`✅ Successfully killed process ${pid}`);
        }
      } catch (err) {
        debugLog(`⚠️ No process found using port ${port}`);
      }
    }
  } catch (error) {
    debugLog(`⚠️ Error checking port ${port}: ${error.message}`);
  }
}

async function main() {
  const targetPid = process.argv[2];
  
  debugLog('🛑 Starting shutdown process...');
  debugLog(`Script started with PID argument: ${targetPid}`);
  debugLog(`PORT from env: ${PORT}`);
  
  // Kill the specific process if PID provided
  if (targetPid && !isNaN(targetPid)) {
    try {
      debugLog(`💀 Force killing process ${targetPid}...`);
      if (process.platform === 'win32') {
        await execAsync(`taskkill /F /PID ${targetPid}`);
      } else {
        await execAsync(`kill -9 ${targetPid}`);
      }
      debugLog(`✅ Killed process ${targetPid}`);
    } catch (error) {
      debugLog(`⚠️ Failed to kill process ${targetPid}: ${error.message}`);
    }
  }
  
  // Clean up main port
  debugLog(`🧹 Cleaning up port ${PORT}...`);
  await killProcessOnPort(PORT);
  
  // Clean up debug ports
  debugLog('🧹 Cleaning up debug ports...');
  for (const debugPort of DEBUG_PORTS) {
    await killProcessOnPort(debugPort);
  }
  
  debugLog('✅ Shutdown complete');
  process.exit(0);
}

main().catch((error) => {
  debugLog(`Shutdown script error: ${error.message}`);
  process.exit(1);
});