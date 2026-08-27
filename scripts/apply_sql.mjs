import postgres from "postgres";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL manquante");
  process.exit(1);
}

// Nettoyage et encodage du mot de passe si nécessaire
const sql = postgres(databaseUrl, { prepare: false });

async function apply() {
  try {
    console.log("🛠️ Création de la table bank_cache dans Supabase...");
    await sql`
      CREATE TABLE IF NOT EXISTS bank_cache (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        user_id uuid,
        bank_module text DEFAULT 'cmb' NOT NULL,
        accounts_data jsonb NOT NULL,
        total_balance numeric(18, 8) DEFAULT '0' NOT NULL,
        currency text DEFAULT 'EUR' NOT NULL,
        synced_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    await sql`
      ALTER TABLE IF EXISTS bank_cache ENABLE ROW LEVEL SECURITY;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'bank_cache' AND policyname = 'Public and service can access bank_cache'
        ) THEN
          CREATE POLICY "Public and service can access bank_cache" ON bank_cache FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END
      $$;
    `;

    console.log("✅ Table bank_cache et politiques RLS créées avec succès dans Supabase !");
  } catch (err) {
    console.error("❌ Erreur SQL :", err);
  } finally {
    await sql.end();
  }
}

apply();
