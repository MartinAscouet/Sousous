import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url({ message: "NEXT_PUBLIC_SUPABASE_URL doit être une URL valide." }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, { message: "NEXT_PUBLIC_SUPABASE_ANON_KEY ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est requise." }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  CRON_SECRET: z
    .string()
    .min(16, { message: "CRON_SECRET doit contenir au moins 16 caractères." })
    .default("super-secret-cron-token-sousous-2026"),
  COINGECKO_API_KEY: z.string().optional(),
});

function parseEnv() {
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET || "super-secret-cron-token-sousous-2026",
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  });

  if (!result.success) {
    console.error("❌ Variables d'environnement invalides ou manquantes :");
    console.error(result.error.flatten().fieldErrors);
    throw new Error(
      "Échec de validation des variables d'environnement. Veuillez corriger le fichier .env.local"
    );
  }

  return result.data;
}

export const env = parseEnv();
