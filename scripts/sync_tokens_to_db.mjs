import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL manquante dans .env.local");
  process.exit(1);
}

const tokensFilePath = path.join(__dirname, "..", ".saxo_tokens.json");
if (!fs.existsSync(tokensFilePath)) {
  console.error("❌ Fichier .saxo_tokens.json introuvable");
  process.exit(1);
}

const tokens = JSON.parse(fs.readFileSync(tokensFilePath, "utf-8"));
console.log("📖 Lecture des tokens locaux :", {
  accessToken: tokens.accessToken?.slice(0, 15) + "...",
  expiresAt: new Date(tokens.expiresAt),
  env: tokens.env || "live",
});

const sql = postgres(databaseUrl, { prepare: false });

async function sync() {
  try {
    const expiresAt = new Date(tokens.expiresAt);
    const refreshTokenExpiresAt = tokens.refreshTokenExpiresAt ? new Date(tokens.refreshTokenExpiresAt) : null;

    const existing = await sql`SELECT id FROM oauth_tokens WHERE provider = 'saxo' LIMIT 1`;

    if (existing.length > 0) {
      await sql`
        UPDATE oauth_tokens
        SET
          access_token = ${tokens.accessToken},
          refresh_token = ${tokens.refreshToken},
          token_type = ${tokens.tokenType || 'Bearer'},
          expires_at = ${expiresAt},
          refresh_token_expires_at = ${refreshTokenExpiresAt},
          scope = ${tokens.scope || null},
          base_uri = ${tokens.baseUri || null},
          env = ${tokens.env || 'live'},
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      console.log("✅ Tokens Saxo mis à jour dans la table oauth_tokens sur Supabase !");
    } else {
      await sql`
        INSERT INTO oauth_tokens (
          provider,
          access_token,
          refresh_token,
          token_type,
          expires_at,
          refresh_token_expires_at,
          scope,
          base_uri,
          env
        ) VALUES (
          'saxo',
          ${tokens.accessToken},
          ${tokens.refreshToken},
          ${tokens.tokenType || 'Bearer'},
          ${expiresAt},
          ${refreshTokenExpiresAt},
          ${tokens.scope || null},
          ${tokens.baseUri || null},
          ${tokens.env || 'live'}
        )
      `;
      console.log("✅ Tokens Saxo insérés avec succès dans la table oauth_tokens sur Supabase !");
    }
  } catch (err) {
    console.error("❌ Erreur lors de la synchronisation :", err);
  } finally {
    await sql.end();
  }
}

sync();
