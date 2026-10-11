import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;
let database: Database | undefined;

function databaseUrl() {
  // Neon’s Vercel Marketplace integration scopes this project’s connection
  // string under GH_DATABASE_URL. DATABASE_URL remains supported for local
  // development and deliberately configured environments.
  return process.env.DATABASE_URL ?? process.env.GH_DATABASE_URL;
}

export function isDatabaseConfigured() { return Boolean(databaseUrl()); }

export function getDb(): Database {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  if (!database) database = drizzle(neon(url), { schema });
  return database;
}
