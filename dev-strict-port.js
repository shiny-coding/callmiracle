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
      // Find the process using the port
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        
        if (pid && pid !== '0') {
          try {
            console.log(`Killing process ${pid} using port ${port}...`);
            await execAsync(`taskkill /F /PID ${pid}`);
          } catch (err) {
            // Process might have already exited
          }
        }
      }
    } else {
      // For Unix-like systems (Mac, Linux)
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        
        for (const pid of pids) {
          console.log(`Killing process ${pid} using port ${port}...`);
          await execAsync(`kill -9 ${pid}`);
        }
      } catch (err) {
        // No process found using the port
      }
    }
    
    // Wait a bit for the port to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    // Ignore errors - port might not be in use
  }
}

async function main() {
  // Debug ports that Next.js commonly uses
  const debugPorts = [9229, 9230];
  
  // Check and kill debug ports first
  for (const debugPort of debugPorts) {
    const isDebugPortAvailable = await checkPort(debugPort);
    if (!isDebugPortAvailable) {
      console.log(`\x1b[33mDebug port ${debugPort} is in use. Killing process...\x1b[0m`);
      await killProcessOnPort(debugPort);
    }
  }
  
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
  
  nextProcess.on('exit', (code) => {
    process.exit(code);
  });
}

main().catch((error) => {
  console.error('Failed to start dev server:', error);
  process.exit(1);
});