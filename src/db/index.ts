import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "";

// Désactivation de la préparation d'instructions pour la compatibilité Supabase Transaction Pooler (port 6543)
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
