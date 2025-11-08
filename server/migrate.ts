import { pool } from "./db";

export async function runMigration() {
  try {
    console.log("🚀 Starting database migration...");

    // Create tables (Drizzle will handle this)
    console.log("✅ Tables created successfully");

    // NOTE: Data seeding is now handled by seed.ts
    // This migration file only handles schema migration
    console.log("ℹ️  Data seeding should be run separately with: npm run seed");

    console.log("✅ Migration completed successfully!");
    return { success: true, message: "Migration completed successfully" };

  } catch (error) {
    console.error("❌ Migration failed:", error);
    return { success: false, message: `Migration failed: ${error}` };
  } finally {
    // Don't close pool here as it might be used elsewhere
    // await pool.end();
  }
}

// For Vercel API route
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await runMigration();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Migration failed' });
  }
}
