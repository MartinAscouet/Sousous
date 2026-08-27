import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { BankingAccount, BankingApiResponse } from "@/types/banking";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { bankCredentials, bankCache } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

// Forcer le rendu dynamique pour éviter la mise en cache statique de la route
export const dynamic = "force-dynamic";

/**
 * Charge les derniers comptes bancaires enregistrés dans le cache Supabase
 */
async function loadCachedBankingAccounts(): Promise<BankingApiResponse | null> {
  // 1. Tenter via Drizzle ORM
  try {
    const rows = await db
      .select()
      .from(bankCache)
      .orderBy(desc(bankCache.updatedAt))
      .limit(1);

    if (rows && rows.length > 0) {
      const row = rows[0];
      console.log(`[Banking Cache] ✅ ${Array.isArray(row.accountsData) ? row.accountsData.length : 0} comptes chargés depuis Supabase via Drizzle.`);
      return {
        success: true,
        accounts: row.accountsData as BankingAccount[],
        totalBalance: Number(row.totalBalance),
        currency: row.currency,
        fetchedAt: row.syncedAt.toISOString(),
      };
    }
  } catch (drizzleErr: unknown) {
    console.warn("[Banking Cache] ⚠️ Échec lecture Drizzle, tentative via Supabase REST :", (drizzleErr as Error).message);
  }

  // 2. Fallback via Supabase REST API (HTTPS port 443)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
      const supabase = createSupabaseClient(url, key, { auth: { persistSession: false } });
      const { data } = await supabase.from("bank_cache").select("*").order("updated_at", { ascending: false }).limit(1);
      if (data && data.length > 0) {
        const row = data[0];
        console.log(`[Banking Cache] ✅ Comptes chargés depuis Supabase REST API.`);
        return {
          success: true,
          accounts: (row.accounts_data || []) as BankingAccount[],
          totalBalance: Number(row.total_balance || 0),
          currency: row.currency || "EUR",
          fetchedAt: row.synced_at || row.updated_at || new Date().toISOString(),
        };
      }
    }
  } catch (restErr: unknown) {
    console.error("[Banking Cache] ❌ Erreur lecture REST :", (restErr as Error).message);
  }

  return null;
}

/**
 * Sauvegarde la synthèse des comptes bancaires dans Supabase
 */
async function saveBankingAccountsToCache(data: BankingApiResponse): Promise<void> {
  if (!data.success || !data.accounts) return;
  const total = String(data.totalBalance || 0);
  const curr = data.currency || "EUR";

  try {
    const existing = await db.select({ id: bankCache.id }).from(bankCache).limit(1);
    if (existing && existing.length > 0) {
      await db
        .update(bankCache)
        .set({
          accountsData: data.accounts,
          totalBalance: total,
          currency: curr,
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bankCache.id, existing[0].id));
    } else {
      await db.insert(bankCache).values({
        bankModule: "cmb",
        accountsData: data.accounts,
        totalBalance: total,
        currency: curr,
      });
    }
    console.log("[Banking Cache] 💾 Comptes bancaires sauvegardés dans le cache Supabase (Drizzle) !");
  } catch (drizzleErr: unknown) {
    console.warn("[Banking Cache] ⚠️ Échec écriture Drizzle, tentative via REST...", (drizzleErr as Error).message);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
        const supabase = createSupabaseClient(url, key, { auth: { persistSession: false } });
        const { data: existing } = await supabase.from("bank_cache").select("id").limit(1);
        if (existing && existing.length > 0) {
          await supabase
            .from("bank_cache")
            .update({
              accounts_data: data.accounts,
              total_balance: data.totalBalance || 0,
              currency: curr,
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing[0].id);
        } else {
          await supabase.from("bank_cache").insert({
            bank_module: "cmb",
            accounts_data: data.accounts,
            total_balance: data.totalBalance || 0,
            currency: curr,
          });
        }
        console.log("[Banking Cache] 💾 Comptes bancaires sauvegardés dans le cache Supabase (REST) !");
      }
    } catch (restErr: unknown) {
      console.error("[Banking Cache] ❌ Erreur sauvegarde REST :", (restErr as Error).message);
    }
  }
}

export async function GET() {
  try {
    const scriptPath = path.join(process.cwd(), "scripts", "fetch_accounts.py");

    // Résolution de l'interpréteur Python : priorité à PYTHON_PATH, puis .venv local, puis système
    const venvPython =
      process.platform === "win32"
        ? path.join(process.cwd(), ".venv", "Scripts", "python.exe")
        : path.join(process.cwd(), ".venv", "bin", "python");

    let pythonExecutable = process.env.PYTHON_PATH;
    if (!pythonExecutable) {
      pythonExecutable = fs.existsSync(venvPython)
        ? venvPython
        : process.platform === "win32"
        ? "python"
        : "python3";
    }

    // 1. Récupération des identifiants chiffrés pour l'utilisateur connecté (s'il en existe)
    let stdinPayload: { backends: Array<{ module: string; login: string; password: string; label?: string }> } | null = null;

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || "00000000-0000-0000-0000-000000000000";

      const rows = await db
        .select()
        .from(bankCredentials)
        .where(eq(bankCredentials.userId, userId));

      if (rows && rows.length > 0) {
        const decryptedBackends = [];
        for (const row of rows) {
          try {
            const decLogin = decrypt(row.encryptedLogin, row.ivLogin, row.tagLogin);
            const decPass = decrypt(row.encryptedPassword, row.ivPassword, row.tagPassword);
            decryptedBackends.push({
              module: row.bankModule,
              login: decLogin,
              password: decPass,
              label: row.label || undefined,
            });
          } catch (decErr) {
            console.error("Erreur de déchiffrement pour la banque", row.bankModule, decErr);
          }
        }
        if (decryptedBackends.length > 0) {
          stdinPayload = { backends: decryptedBackends };
        }
      }
    } catch (dbErr) {
      console.warn("Impossible de charger les identifiants Supabase (utilisation du fallback local) :", dbErr);
    }

    // 2. Exécution du script Python avec transmission sécurisée par stdin (mémoire RAM uniquement)
    console.log(`[Banking Route] 🐍 Tentative d'exécution Python : ${scriptPath} via ${pythonExecutable}`);

    const runPythonProcess = (): Promise<{ stdout: string; stderr: string; code: number | null }> => {
      return new Promise((resolve, reject) => {
        const child = spawn(pythonExecutable, [scriptPath], {
          env: {
            ...process.env,
            PYTHONIOENCODING: "utf-8",
          },
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
          stdout += data.toString("utf-8");
        });

        child.stderr.on("data", (data) => {
          stderr += data.toString("utf-8");
        });

        const timer = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("TIMEOUT"));
        }, 50000);

        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({ stdout, stderr, code });
        });

        child.on("error", (err: any) => {
          clearTimeout(timer);
          console.warn("[Banking Route] ℹ️ Python non disponible dans cet environnement (Vercel Serverless) :", err.message);
          reject(err);
        });

        // Si des identifiants déchiffrés existent en mémoire, on les envoie directement sur stdin
        if (stdinPayload) {
          child.stdin.write(JSON.stringify(stdinPayload));
        }
        child.stdin.end();
      });
    };

    let result;
    try {
      result = await runPythonProcess();
    } catch (err: any) {
      console.log("[Banking Route] 🔄 Basculement automatique sur les données bancaires en cache Supabase...");
      const cached = await loadCachedBankingAccounts();
      if (cached && cached.accounts && cached.accounts.length > 0) {
        return NextResponse.json(cached, {
          status: 200,
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      }

      const isTimeout = err.message === "TIMEOUT";
      const errorMessage = isTimeout
        ? "Le délai d'attente de synchronisation bancaire a expiré (Timeout)."
        : "Veuillez synchroniser vos comptes bancaires au moins une fois en local (avec votre environnement Python Woob) pour alimenter le tableau de bord en ligne.";

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          errorCode: isTimeout ? "TIMEOUT" : "LOCAL_SYNC_REQUIRED",
          details: err?.message || String(err),
        } as BankingApiResponse,
        { status: isTimeout ? 504 : 200 }
      );
    }

    const { stdout, stderr, code } = result;

    if (!stdout.trim()) {
      const cached = await loadCachedBankingAccounts();
      if (cached && cached.accounts && cached.accounts.length > 0) {
        return NextResponse.json(cached);
      }

      return NextResponse.json(
        {
          success: false,
          error: "Aucune réponse reçue du module de synchronisation.",
          errorCode: "UNKNOWN",
          details: stderr,
        } as BankingApiResponse,
        { status: 500 }
      );
    }

    try {
      const data: BankingApiResponse = JSON.parse(stdout);
      data.fetchedAt = new Date().toISOString();

      // Sauvegarde immédiate dans le cache Supabase pour Vercel
      if (data.success && data.accounts) {
        await saveBankingAccountsToCache(data).catch(() => {});
      }

      return NextResponse.json(data, {
        status: data.success ? 200 : (data.errorCode === "AUTH_REQUIRED" || data.errorCode === "2FA_REQUIRED" ? 401 : 400),
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    } catch (parseErr) {
      return NextResponse.json(
        {
          success: false,
          error: "Erreur de formatage des données retournées par Woob.",
          errorCode: "EXECUTION_ERROR",
          details: stdout || stderr,
        } as BankingApiResponse,
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Erreur interne du serveur lors de la récupération des comptes.",
        errorCode: "UNKNOWN",
        details: error?.message || String(error),
      } as BankingApiResponse,
      { status: 500 }
    );
  }
}
