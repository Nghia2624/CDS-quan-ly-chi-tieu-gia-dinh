// Simple DB readiness checker for Docker compose (ESM)
import { Client } from 'pg';

async function waitForDb(uri, retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = new Client({ connectionString: uri });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('Database is ready.');
      return;
    } catch (err) {
      console.log(`DB not ready (attempt ${i}/${retries}): ${err instanceof Error ? err.message : String(err)}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Database not ready in time');
}

const uri = process.env.DATABASE_URL;
if (!uri) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

try {
  await waitForDb(uri);
} catch (err) {
  console.error(err);
  process.exit(1);
}


