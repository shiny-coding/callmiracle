const { execSync } = require('child_process');

// Get ports from command line arguments, default to '3003'
const ports = process.argv.slice(2);
if (ports.length === 0) {
  ports.push('3003');
}

console.log(`Checking for processes on ports: ${ports.join(', ')}...`);

const allPids = new Set();
const portsWithProcesses = [];

// Check each port for listening processes
ports.forEach(port => {
  try {
    // Find the PID using the port - specifically look for LISTENING processes
    const netstatOutput = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    
    // Parse the output to find PIDs
    const lines = netstatOutput.trim().split('\n');
    const portPids = [];
    
    lines.forEach(line => {
      // netstat output format: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
      const parts = line.trim().split(/\s+/);
      const state = parts[3];
      const pid = parts[parts.length - 1];
      
      // Only add PIDs for LISTENING processes (not TIME_WAIT, CLOSE_WAIT, etc.)
      if (state === 'LISTENING' && pid && /^\d+$/.test(pid)) {
        allPids.add(pid);
        portPids.push(pid);
      }
    });
    
    if (portPids.length > 0) {
      portsWithProcesses.push({ port, pids: portPids });
      console.log(`Found ${portPids.length} process(es) on port ${port}: ${portPids.join(', ')}`);
    } else {
      console.log(`No process found listening on port ${port}`);
    }
    
  } catch (error) {
    if (error.message.includes('Command failed: netstat') || error.message.includes('FINDSTR: Cannot find')) {
      console.log(`No process found listening on port ${port}`);
    } else {
      console.error(`Error checking port ${port}:`, error.message);
    }
  }
});

if (allPids.size === 0) {
  console.log('No processes found on any of the specified ports');
  process.exit(0);
}

// Kill each unique PID
console.log(`\nKilling ${allPids.size} process(es)...`);
allPids.forEach(pid => {
  try {
    console.log(`Killing process with PID ${pid}...`);
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
    console.log(`Successfully killed process ${pid}`);
  } catch (error) {
    console.error(`Failed to kill process ${pid}:`, error.message);
  }
});

console.log('Done.');