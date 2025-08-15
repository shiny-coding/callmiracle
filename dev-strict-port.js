#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const net = require('net');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env.observability' });

const PORT = process.env.PORT || 3003;
const DEBUG_PORTS = [9229, 9230, 9231, 9232];

// Check if port is in use
function checkPort(port) {
  return new Promise((resolve) => {
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

// Kill process using the specified port
async function killProcessOnPort(port) {
  try {
    // For Windows
    if (process.platform === 'win32') {
      // Find the process using the port - look for LISTENING state
      const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
      const lines = stdout.trim().split('\n').filter(line => line.includes('LISTENING'));
      
      if (lines.length === 0) {
        console.log(`No processes found listening on port ${port}`);
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
            
            console.log(`🎯 Killing process ${pid} (${processName}) using port ${port}...`);
            await execAsync(`taskkill /F /PID ${pid}`);
            console.log(`✅ Successfully killed process ${pid}`);
          } catch (err) {
            console.log(`⚠️ Failed to kill process ${pid}: ${err.message}`);
          }
        }
      }
    } else {
      // For Unix-like systems (Mac, Linux)
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        
        if (pids.length === 0) {
          console.log(`No processes found using port ${port}`);
          return;
        }
        
        for (const pid of pids) {
          console.log(`🎯 Killing process ${pid} using port ${port}...`);
          await execAsync(`kill -9 ${pid}`);
          console.log(`✅ Successfully killed process ${pid}`);
        }
      } catch (err) {
        console.log(`⚠️ No process found using port ${port}`);
      }
    }
    
    // Wait a bit for the port to be released
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.log(`⚠️ Error checking port ${port}: ${error.message}`);
  }
}

async function main() {
  
  // More aggressive debug port cleanup - kill ALL node processes using any debug port
  console.log('🔍 Checking for Node.js processes on debug ports...');
  for (const debugPort of DEBUG_PORTS) {
    let attempts = 0;
    while (attempts < 3) {
      const isDebugPortAvailable = await checkPort(debugPort);
      if (!isDebugPortAvailable) {
        console.log(`\x1b[33mDebug port ${debugPort} is in use (attempt ${attempts + 1}). Killing process...\x1b[0m`);
        await killProcessOnPort(debugPort);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer
        attempts++;
      } else {
        break;
      }
    }
  }
  
  // No aggressive cleanup - only kill processes we specifically detected on ports
  
  // Check main application port
  let isPortAvailable = await checkPort(PORT);
  
  if (!isPortAvailable) {
    console.log(`\x1b[33mPort ${PORT} is already in use. Attempting to kill the process...\x1b[0m`);
    await killProcessOnPort(PORT);
    
    // Check again after killing
    isPortAvailable = await checkPort(PORT);
    
    if (!isPortAvailable) {
      console.error(`\x1b[31mError: Failed to free port ${PORT}!\x1b[0m`);
      console.error('Please manually stop the process using this port.');
      process.exit(1);
    }
    
    console.log(`\x1b[32mPort ${PORT} has been freed successfully.\x1b[0m`);
  }
  
  // Start Next.js dev server with turbopack
  console.log(`Starting Next.js dev server on port ${PORT}...`);
  
  const nextProcess = spawn('npx', [
    'next',
    'dev',
    '--turbopack',
    '-p',
    PORT.toString()
  ], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      // Force Next.js to not look for alternative ports
      PORT: PORT.toString(),
      NODE_OPTIONS: '--inspect'
    }
  });
  
  // Handle process termination signals
  let isShuttingDown = false;
  
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\n🛑 Shutting down dev server...');
    
    // Try graceful shutdown first
    nextProcess.kill('SIGINT');
  
    const shutdownScriptPath = path.join(__dirname, 'scripts', 'shutdown-dev.js');
    
    // Spawn shutdown script with detached process to avoid signal inheritance
    // IMPORTANT: detached: true is crucial - without it, the child process receives
    // the same SIGINT signal that triggered this shutdown, causing it to terminate
    // before it can execute the cleanup logic
    const shutdownScript = spawn('node', [
      shutdownScriptPath,
      nextProcess.pid.toString()
    ], {
      stdio: ['ignore', 'inherit', 'inherit'], // Ignore stdin to prevent signal inheritance
      shell: true,
      detached: true, // Detach from parent process group to avoid signal inheritance
      env: { ...process.env, PORT: PORT.toString() }
    });
    
    shutdownScript.on('exit', (code) => {
      process.exit(0);
    });
    
    shutdownScript.on('error', (error) => {
      console.log(`❌ Shutdown script error: ${error.message}`);
      process.exit(1);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Windows-specific: Handle console close events
  if (process.platform === 'win32') {
    const readline = require('readline');
    if (process.stdin.isTTY) {
      readline.createInterface({
        input: process.stdin,
        output: process.stdout
      }).on('SIGINT', shutdown);
    }
  }

  nextProcess.on('exit', (code) => {
    process.exit(code);
  });
}

main().catch((error) => {
  console.error('Failed to start dev server:', error);
  process.exit(1);
});