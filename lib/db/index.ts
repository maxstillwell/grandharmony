import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;
let database: Database | undefined;

export function isDatabaseConfigured() { return Boolean(process.env.DATABASE_URL); }

export function getDb(): Database {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  if (!database) database = drizzle(neon(process.env.DATABASE_URL), { schema });
  return database;
}
