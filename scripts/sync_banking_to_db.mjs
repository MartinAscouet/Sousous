/**
 * Script de synchronisation manuelle des comptes bancaires (Woob) vers Supabase
 * Exécution : node scripts/sync_banking_to_db.mjs
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const scriptPath = path.join(__dirname, "fetch_accounts.py");
const venvPython =
  process.platform === "win32"
    ? path.join(__dirname, "..", ".venv", "Scripts", "python.exe")
    : path.join(__dirname, "..", ".venv", "bin", "python");

const pythonExecutable = fs.existsSync(venvPython)
  ? venvPython
  : process.platform === "win32"
  ? "python"
  : "python3";

console.log("=================================================");
console.log("🏦 SYNCHRONISATION BANCAIRE VERS SUPABASE (WOOB)");
console.log("=================================================");
console.log(`🐍 Exécutable Python : ${pythonExecutable}`);

const child = spawn(pythonExecutable, [scriptPath], {
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
child.stderr.on("data", (d) => (stderr += d.toString("utf-8")));

child.on("close", async (code) => {
  if (!stdout.trim()) {
    console.error("❌ Aucune réponse reçue du script Python :", stderr);
    process.exit(1);
  }

  try {
    const data = JSON.parse(stdout);
    if (!data.success || !Array.isArray(data.accounts)) {
      console.error("❌ Échec de la récupération bancaire :", data.error || data);
      process.exit(1);
    }

    console.log(`\n✅ ${data.accounts.length} comptes récupérés avec succès :`);
    data.accounts.forEach((acc) => {
      console.log(`  - [${acc.type}] ${acc.label} : ${acc.balance} ${acc.currency || "EUR"}`);
    });
    console.log(`💰 Solde Total : ${data.totalBalance} ${data.currency || "EUR"}`);

    // Sauvegarde dans Supabase
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn("⚠️ DATABASE_URL non définie, les comptes restent en local uniquement.");
      process.exit(0);
    }

    const sql = postgres(databaseUrl, { prepare: false });
    const existing = await sql`SELECT id FROM bank_cache WHERE bank_module = 'cmb' LIMIT 1`;

    if (existing.length > 0) {
      await sql`
        UPDATE bank_cache
        SET
          accounts_data = ${JSON.stringify(data.accounts)},
          total_balance = ${data.totalBalance || 0},
          currency = ${data.currency || 'EUR'},
          synced_at = NOW(),
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      console.log("\n💾 Comptes bancaires mis à jour dans la table bank_cache sur Supabase !");
    } else {
      await sql`
        INSERT INTO bank_cache (
          bank_module, accounts_data, total_balance, currency, synced_at, updated_at
        ) VALUES (
          'cmb',
          ${JSON.stringify(data.accounts)},
          ${data.totalBalance || 0},
          ${data.currency || 'EUR'},
          NOW(),
          NOW()
        )
      `;
      console.log("\n💾 Comptes bancaires insérés dans la table bank_cache sur Supabase !");
    }

    await sql.end();
    console.log("🎉 Synchronisation terminée avec succès !");
  } catch (err) {
    console.error("❌ Erreur de traitement :", err);
    process.exit(1);
  }
});
