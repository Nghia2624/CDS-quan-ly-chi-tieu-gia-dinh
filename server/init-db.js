#!/usr/bin/env node

import { execSync } from 'child_process';
import { Client } from 'pg';

async function waitForDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/financeflow'
  });

  let retries = 30;
  while (retries > 0) {
    try {
      await client.connect();
      console.log('✅ Database is ready');
      await client.end();
      return;
    } catch (error) {
      console.log(`⏳ Waiting for database... (${retries} retries left)`);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('❌ Database connection timeout');
}

async function runMigrations() {
  try {
    console.log('🚀 Starting database initialization...');
    
    // Wait for database
    await waitForDatabase();
    
    // Create extension
    console.log('📦 Creating pgcrypto extension...');
    execSync('node server/create-extension.js', { stdio: 'inherit' });
    
    // Run migrations
    console.log('🔄 Running database migrations...');
    execSync('npx drizzle-kit push', { stdio: 'inherit' });
    
    // Seed data
    console.log('🌱 Seeding initial data...');
    execSync('npm run seed', { stdio: 'inherit' });
    
    console.log('✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

runMigrations().catch(console.error);
