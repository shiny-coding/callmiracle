const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_NAME = 'callmiracle';
const SOURCE_DIR = path.join(__dirname, '..', 'observability', 'dashboards');
const TARGET_DIR = path.join(__dirname, '..', '..', 'observability', 'dashboards', PROJECT_NAME);

console.log(`Syncing dashboards from ${SOURCE_DIR} to ${TARGET_DIR}\n`);

// Check source directory exists
if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`Source directory not found: ${SOURCE_DIR}`);
  process.exit(1);
}

// Ensure target directory exists
fs.mkdirSync(TARGET_DIR, { recursive: true });

// Get all JSON files from source
const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'));

if (files.length === 0) {
  console.log('No dashboard files found to sync.');
  process.exit(0);
}

// Copy each dashboard file
for (const file of files) {
  const sourcePath = path.join(SOURCE_DIR, file);
  const targetPath = path.join(TARGET_DIR, file);
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`  Copied: ${file}`);
}

console.log(`\nSynced ${files.length} dashboard(s) to ${TARGET_DIR}`);

// Reload Grafana if running
try {
  execSync('docker exec grafana kill -HUP 1', { stdio: 'pipe' });
  console.log('\nGrafana reloaded successfully');
} catch (e) {
  console.log('\nGrafana not running or reload skipped');
}
