import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let db: any = null;
let pool: any = null;

// Only initialize database if DATABASE_URL is provided
// Otherwise, run in demo/development mode
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  db = drizzle(pool);
} else {
  // Mock database for demo/development mode
  console.log("[v0] Running in demo mode - DATABASE_URL not set");
  db = {
    select: () => ({ from: () => Promise.resolve([]) }),
    insert: () => ({ values: () => Promise.resolve() }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  };
}

export { db, pool };
