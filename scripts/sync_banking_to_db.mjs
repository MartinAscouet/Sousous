/**
 * Script de synchronisation manuelle des comptes bancaires (Woob) vers Supabase
 * Exécution : node scripts/sync_banking_to_db.mjs
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

function decrypt(encryptedData, ivBase64, tagBase64) {
  const secret = process.env.ENCRYPTION_SECRET || process.env.CRON_SECRET || "default-dev-secret-key-change-in-prod-32b";
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

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

async function run() {
  let stdinPayload = null;

  // 1. Récupération des identifiants bancaires chiffrés depuis Supabase si configurés
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      const { data: rows } = await supabase.from("bank_credentials").select("*");
      if (rows && rows.length > 0) {
        const decryptedBackends = [];
        for (const row of rows) {
          try {
            const decLogin = decrypt(row.encrypted_login, row.iv_login, row.tag_login);
            const decPass = decrypt(row.encrypted_password, row.iv_password, row.tag_password);
            decryptedBackends.push({
              module: row.bank_module,
              login: decLogin,
              password: decPass,
              label: row.label || undefined,
            });
          } catch (e) {
            console.warn(`[Sync] ⚠️ Erreur déchiffrement pour ${row.bank_module} :`, e.message);
          }
        }
        if (decryptedBackends.length > 0) {
          stdinPayload = { backends: decryptedBackends };
          console.log(`🔑 ${decryptedBackends.length} accès bancaire(s) sécurisé(s) injecté(s) en mémoire.`);
        }
      }
    } catch (dbErr) {
      console.warn("[Sync] ℹ️ Utilisation de la configuration locale Woob existante.");
    }
  }

  console.log("⏳ Connexion sécurisée à votre banque en cours...");

  const child = spawn(pythonExecutable, [scriptPath], {
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
  child.stderr.on("data", (d) => (stderr += d.toString("utf-8")));

  // CRITIQUE : Envoyer le payload et fermer le stream stdin immédiatement pour éviter tout blocage
  if (stdinPayload) {
    child.stdin.write(JSON.stringify(stdinPayload));
  }
  child.stdin.end();

  child.on("close", async (code) => {
    if (!stdout.trim()) {
      console.error("❌ Aucune réponse reçue du script Python :", stderr);
      process.exit(1);
    }

    try {
      const data = JSON.parse(stdout);
      if (!data.success || !Array.isArray(data.accounts)) {
        console.error("\n❌ Échec de la récupération bancaire :", data.error || data);
        if (data.details) console.error("Détails :", data.details);
        process.exit(1);
      }

      console.log(`\n✅ ${data.accounts.length} comptes récupérés avec succès :`);
      data.accounts.forEach((acc) => {
        console.log(`  - [${acc.type}] ${acc.label} : ${acc.balance} ${acc.currency || "EUR"}`);
      });
      console.log(`💰 Solde Total : ${data.totalBalance} ${data.currency || "EUR"}`);

      // 2. Sauvegarde dans Supabase
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
        const { data: existing } = await supabase.from("bank_cache").select("id").eq("bank_module", "cmb").limit(1);

        if (existing && existing.length > 0) {
          const { error: updateErr } = await supabase
            .from("bank_cache")
            .update({
              accounts_data: data.accounts,
              total_balance: data.totalBalance || 0,
              currency: data.currency || "EUR",
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing[0].id);

          if (updateErr) console.error("❌ Erreur mise à jour Supabase :", updateErr.message);
          else console.log("\n💾 Comptes bancaires mis à jour dans la table bank_cache sur Supabase !");
        } else {
          const { error: insertErr } = await supabase.from("bank_cache").insert({
            bank_module: "cmb",
            accounts_data: data.accounts,
            total_balance: data.totalBalance || 0,
            currency: data.currency || "EUR",
          });

          if (insertErr) console.error("❌ Erreur insertion Supabase :", insertErr.message);
          else console.log("\n💾 Comptes bancaires insérés dans la table bank_cache sur Supabase !");
        }
      }

      console.log("\n🎉 Synchronisation terminée avec succès !");
      process.exit(0);
    } catch (err) {
      console.error("❌ Erreur de traitement JSON :", err);
      process.exit(1);
    }
  });
}

run();
