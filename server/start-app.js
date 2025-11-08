#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting FinanceFlow application...');

// Start the main application
const app = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

app.on('error', (error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});

app.on('exit', (code) => {
  console.log(`📱 Application exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down application...');
  app.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down application...');
  app.kill('SIGTERM');
});
