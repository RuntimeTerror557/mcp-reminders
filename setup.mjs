#!/usr/bin/env node
// One-command setup for mcp-reminders + Claude Desktop.
// Usage (from inside the mcp-reminders-master folder):  node setup.mjs

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(projectDir, 'dist', 'index.js');

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: projectDir, stdio: 'inherit' });
}

function configPath() {
  const home = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    default:
      return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Claude', 'claude_desktop_config.json');
  }
}

// 1. Install + build
run('npm install');
run('npm run build');

if (!fs.existsSync(entry)) {
  console.error(`\nBuild failed: ${entry} was not created.`);
  process.exit(1);
}

// 2. Merge into Claude Desktop config
const cfgFile = configPath();
fs.mkdirSync(path.dirname(cfgFile), { recursive: true });

let config = {};
if (fs.existsSync(cfgFile)) {
  const raw = fs.readFileSync(cfgFile, 'utf8').trim();
  if (raw) {
    try {
      config = JSON.parse(raw);
    } catch (e) {
      console.error(`\nYour existing config is not valid JSON, so I won't touch it:\n  ${cfgFile}\n${e.message}`);
      console.error('\nFix it (or delete it), then re-run. Or add this manually inside "mcpServers":');
      console.error(JSON.stringify({ reminders: { command: 'node', args: [entry] } }, null, 2));
      process.exit(1);
    }
  }
  fs.copyFileSync(cfgFile, cfgFile + '.backup');
  console.log(`\nBacked up existing config to ${cfgFile}.backup`);
}

config.mcpServers = config.mcpServers || {};
config.mcpServers.reminders = { command: process.execPath, args: [entry] };

fs.writeFileSync(cfgFile, JSON.stringify(config, null, 2) + '\n');

console.log(`\nDone. Registered "reminders" in:\n  ${cfgFile}`);
console.log(`Server entry:\n  ${entry}`);
console.log('\nLast step: FULLY quit Claude Desktop (Cmd+Q / tray icon > Quit) and reopen it.');
console.log('Then ask Claude: "Remind me to test this setup, high priority" and "Check my reminders".');
