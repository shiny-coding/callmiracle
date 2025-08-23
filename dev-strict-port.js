#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const { checkPort, killProcessOnPort, cleanupDebugPorts, DEFAULT_DEBUG_PORTS } = require('./scripts/dev-utils');

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env.observability' });

const PORT = process.env.PORT || 3003;

async function main() {
  // Clean up debug ports before starting
  console.log('🔍 Checking for Node.js processes on debug ports...');
  await cleanupDebugPorts(DEFAULT_DEBUG_PORTS);
  
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