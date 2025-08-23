#!/usr/bin/env node

/**
 * Development Utilities
 * 
 * Common functionality for managing development server processes and ports.
 * Used by both dev-strict-port.js and shutdown-dev.js to ensure consistent
 * port management and process cleanup.
 * 
 * Key Features:
 * - Port availability checking
 * - Process termination by port or PID
 * - Debug port cleanup for Node.js inspector
 * - Complete development server shutdown workflow
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const DEFAULT_DEBUG_PORTS = [9229, 9230, 9231, 9232];

/**
 * Check if a port is available (not in use)
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available, false if in use
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port);
  });
}

/**
 * Kill process using the specified port
 * @param {number} port - Port number
 * @param {boolean} verbose - Whether to log detailed output
 * @returns {Promise<void>}
 */
async function killProcessOnPort(port, verbose = true) {
  try {
    if (process.platform === 'win32') {
      // Find the process using the port - look for LISTENING state
      const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
      const lines = stdout.trim().split('\n').filter(line => line.includes('LISTENING'));
      
      if (lines.length === 0) {
        if (verbose) console.log(`No processes found listening on port ${port}`);
        return;
      }
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        
        if (pid && pid !== '0' && !isNaN(pid)) {
          try {
            // Get process name for better logging
            const { stdout: processInfo } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
            const processName = processInfo.split(',')[0].replace(/"/g, '');
            
            if (verbose) console.log(`🎯 Killing process ${pid} (${processName}) using port ${port}...`);
            await execAsync(`taskkill /F /PID ${pid}`);
            if (verbose) console.log(`✅ Successfully killed process ${pid}`);
          } catch (err) {
            if (verbose) console.log(`⚠️ Failed to kill process ${pid}: ${err.message}`);
          }
        }
      }
    } else {
      // For Unix-like systems (Mac, Linux)
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        
        if (pids.length === 0) {
          if (verbose) console.log(`No processes found using port ${port}`);
          return;
        }
        
        for (const pid of pids) {
          if (verbose) console.log(`🎯 Killing process ${pid} using port ${port}...`);
          await execAsync(`kill -9 ${pid}`);
          if (verbose) console.log(`✅ Successfully killed process ${pid}`);
        }
      } catch (err) {
        if (verbose) console.log(`⚠️ No process found using port ${port}`);
      }
    }
    
    // Wait a bit for the port to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    if (verbose) console.log(`⚠️ Error checking port ${port}: ${error.message}`);
  }
}

/**
 * Kill a specific process by PID
 * @param {string|number} pid - Process ID
 * @param {boolean} verbose - Whether to log detailed output
 * @returns {Promise<void>}
 */
async function killProcessByPid(pid, verbose = true) {
  if (!pid || isNaN(pid)) {
    if (verbose) console.log(`⚠️ Invalid PID: ${pid}`);
    return;
  }

  try {
    if (verbose) console.log(`💀 Force killing process ${pid}...`);
    
    if (process.platform === 'win32') {
      await execAsync(`taskkill /F /PID ${pid}`);
    } else {
      await execAsync(`kill -9 ${pid}`);
    }
    
    if (verbose) console.log(`✅ Killed process ${pid}`);
  } catch (error) {
    if (verbose) console.log(`⚠️ Failed to kill process ${pid}: ${error.message}`);
  }
}

/**
 * Clean up debug ports used by Node.js inspector
 * @param {number[]} debugPorts - Array of debug ports to clean (defaults to common Node.js debug ports)
 * @param {boolean} verbose - Whether to log detailed output
 * @returns {Promise<void>}
 */
async function cleanupDebugPorts(debugPorts = DEFAULT_DEBUG_PORTS, verbose = true) {
  if (verbose) console.log('🧹 Cleaning up debug ports...');
  
  for (const debugPort of debugPorts) {
    let attempts = 0;
    while (attempts < 3) {
      const isDebugPortAvailable = await checkPort(debugPort);
      if (!isDebugPortAvailable) {
        if (verbose) console.log(`\x1b[33mDebug port ${debugPort} is in use (attempt ${attempts + 1}). Killing process...\x1b[0m`);
        await killProcessOnPort(debugPort, verbose);
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      } else {
        break;
      }
    }
  }
}

/**
 * Complete development server shutdown process
 * @param {Object} options - Shutdown options
 * @param {string|number} options.nextjsPid - Next.js process PID to kill
 * @param {number} options.port - Main application port to clean up
 * @param {number[]} options.debugPorts - Debug ports to clean up (optional)
 * @param {boolean} options.verbose - Whether to log detailed output
 * @returns {Promise<void>}
 */
async function shutdownDevServer({
  nextjsPid,
  port = 3003,
  debugPorts = DEFAULT_DEBUG_PORTS,
  verbose = true
}) {
  if (verbose) console.log('🛑 Starting development server shutdown...');
  
  // Kill the specific Next.js process if PID provided
  if (nextjsPid) {
    await killProcessByPid(nextjsPid, verbose);
  }
  
  // Clean up main application port
  if (verbose) console.log(`🧹 Cleaning up port ${port}...`);
  await killProcessOnPort(port, verbose);
  
  // Clean up debug ports
  await cleanupDebugPorts(debugPorts, verbose);
  
  if (verbose) console.log('✅ Development server shutdown complete');
}

module.exports = {
  checkPort,
  killProcessOnPort,
  killProcessByPid,
  cleanupDebugPorts,
  shutdownDevServer,
  DEFAULT_DEBUG_PORTS
};