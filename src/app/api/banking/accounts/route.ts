import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { BankingApiResponse } from "@/types/banking";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { bankCredentials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

// Forcer le rendu dynamique pour éviter la mise en cache statique de la route
export const dynamic = "force-dynamic";

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
    console.log(`[Banking Route] 🐍 Lancement du script Python : ${scriptPath} avec l'exécutable : ${pythonExecutable}`);

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
          console.error("[Banking Route] ❌ Erreur spawn Python (Python/Woob non installé ou indisponible) :", err.message);
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
      const isTimeout = err.message === "TIMEOUT";
      const isNotFound = err.code === "ENOENT";
      console.error("[Banking Route] ❌ Exception lors de l'exécution du processus Python :", err);

      const errorMessage = isTimeout
        ? "Le délai d'attente de synchronisation bancaire a expiré (Timeout)."
        : isNotFound
        ? "L'exécutable Python / Woob n'est pas disponible sur cet environnement serveur (Vercel Serverless)."
        : "Échec de l'exécution du script de synchronisation bancaire.";

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          errorCode: isTimeout ? "TIMEOUT" : isNotFound ? "PYTHON_NOT_FOUND" : "EXECUTION_ERROR",
          details: err?.message || String(err),
        } as BankingApiResponse,
        { status: isTimeout ? 504 : isNotFound ? 503 : 500 }
      );
    }

    const { stdout, stderr, code } = result;

    if (!stdout.trim()) {
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
