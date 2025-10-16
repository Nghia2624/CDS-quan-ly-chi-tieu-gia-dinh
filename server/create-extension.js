import { Client } from 'pg';

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: uri });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    console.log('Ensured pgcrypto extension exists.');
  } finally {
    await client.end();
  }
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}


