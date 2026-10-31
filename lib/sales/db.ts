import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../db/schema";

// The HTTP driver's transaction() is unsupported. Sales mutations require a
// real transaction for inventory/audit and immutable publication pointer changes.
neonConfig.webSocketConstructor = ws;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getSalesDb() {
  const url = process.env.DATABASE_URL ?? process.env.GH_DATABASE_URL;
  if (!url)
    throw new Error(
      "Database is not configured. Sales migration has not been verified.",
    );
  if (!database)
    database = drizzle(new Pool({ connectionString: url }), { schema });
  return database;
}
export type SalesDb = ReturnType<typeof getSalesDb>;
