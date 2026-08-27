/**
 * Script utilitaire d'authentification initiale OAuth 2.0 (Authorization Code Flow) pour Saxo OpenAPI
 * 
 * Exécution : node scripts/saxo_auth_flow.mjs
 */

import http from "http";
import url from "url";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chargement des variables d'environnement
const envLocalPath = path.join(__dirname, "..", ".env.local");
const envPath = path.join(__dirname, "..", ".env");
const tokensFilePath = path.join(__dirname, "..", ".saxo_tokens.json");

dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

// 1. Validation de la configuration
const rawAppKey = process.env.SAXO_APP_KEY || "";
const rawAppSecret = process.env.SAXO_APP_SECRET || "";
const rawRedirectUri = process.env.SAXO_REDIRECT_URI || "http://localhost:3000/callback";

// Support du flag CLI --env sim / --env live en priorité, sinon .env.local
const cliEnvIndex = process.argv.indexOf("--env");
const cliEnv = cliEnvIndex !== -1 && process.argv[cliEnvIndex + 1] ? process.argv[cliEnvIndex + 1] : undefined;
const rawEnv = cliEnv || process.env.SAXO_ENV || "sim";

// Nettoyage des éventuels guillemets et espaces
const appKey = rawAppKey.replace(/^["']|["']$/g, "").trim();
const appSecret = rawAppSecret.replace(/^["']|["']$/g, "").trim();
const redirectUri = rawRedirectUri.replace(/^["']|["']$/g, "").trim();
const env = rawEnv.toLowerCase() === "live" ? "live" : "sim";

if (!appKey || !appSecret) {
  console.error("\n❌ ERREUR DE CONFIGURATION :");
  console.error("Veuillez renseigner SAXO_APP_KEY et SAXO_APP_SECRET dans votre fichier .env.local\n");
  process.exit(1);
}

// Extraction du port et du chemin depuis SAXO_REDIRECT_URI
const parsedRedirect = new URL(redirectUri);
const serverPort = parseInt(parsedRedirect.port || (parsedRedirect.protocol === "https:" ? "443" : "80"), 10) || 3000;
const callbackPath = parsedRedirect.pathname || "/callback";

const authHost = env === "sim" ? "https://sim.logonvalidation.net" : "https://live.logonvalidation.net";
const authorizeUrl = `${authHost}/authorize`;
const tokenEndpoint = `${authHost}/token`;

// Génération d'un state aléatoire cryptographique pour sécuriser la session
const sessionState = crypto.randomBytes(16).toString("hex");

// Construction de l'URL d'autorisation Saxo
const authRedirectUrl = new URL(authorizeUrl);
authRedirectUrl.searchParams.append("response_type", "code");
authRedirectUrl.searchParams.append("client_id", appKey);
authRedirectUrl.searchParams.append("redirect_uri", redirectUri);
authRedirectUrl.searchParams.append("state", sessionState);

/**
 * Fonction d'ouverture automatique du navigateur par défaut
 */
function openBrowser(targetUrl) {
  const start =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
      ? "start"
      : "xdg-open";
  exec(`${start} "${targetUrl}"`, (err) => {
    if (err) {
      console.log("ℹ️ Impossible d'ouvrir automatiquement le navigateur. Veuillez copier-coller l'URL ci-dessus.");
    }
  });
}

/**
 * Met à jour ou ajoute une clé dans le fichier .env.local
 */
function updateEnvLocal(keyValues) {
  try {
    let content = "";
    if (fs.existsSync(envLocalPath)) {
      content = fs.readFileSync(envLocalPath, "utf-8");
    }

    for (const [key, value] of Object.entries(keyValues)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
      } else {
        content += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envLocalPath, content.trim() + "\n", "utf-8");
    console.log(`[Config] 📝 Fichier .env.local mis à jour avec succès.`);
  } catch (err) {
    console.warn(`[Config] ⚠️ Impossible d'écrire dans .env.local :`, err.message);
  }
}

/**
 * Échange le code d'autorisation contre les tokens (Access Token & Refresh Token)
 */
async function exchangeCodeForTokens(authCode) {
  console.log(`\n[OAuth 2.0] 🔄 Échange du code d'autorisation contre les jetons d'accès...`);

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: authCode,
    redirect_uri: redirectUri,
    client_id: appKey,
    client_secret: appSecret,
  });

  const basicAuth = Buffer.from(`${appKey}:${appSecret}`).toString("base64");

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`Erreur lors de l'échange du token [HTTP ${res.status}] : ${data.error_description || data.error || res.statusText}`);
  }

  return data;
}

// 2. Lancement du serveur HTTP temporaire
console.log("\n==================================================================");
console.log("🔐 SAXO OPENAPI — INITIALISATION OAUTH 2.0 (AUTHORIZATION CODE)");
console.log("==================================================================");
console.log(`📡 Environnement : [${env.toUpperCase()}]`);
console.log(`🌐 Callback URI  : ${redirectUri}`);
console.log(`🚪 Port d'écoute : ${serverPort}`);
console.log("==================================================================\n");

const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);

  // Vérification de la route de callback
  if (reqUrl.pathname === callbackPath) {
    const { code, state, error, error_description } = reqUrl.query;

    // A. Cas d'erreur renvoyé par Saxo
    if (error) {
      console.error(`\n❌ Authentification refusée par Saxo : ${error} (${error_description || "Aucun détail"})`);
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <title>Erreur d'authentification Saxo</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #ef4444; max-width: 500px; text-align: center; }
            h1 { color: #f87171; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>❌ Échec de la connexion</h1>
            <p><strong>Erreur :</strong> ${error}</p>
            <p>${error_description || "La demande d'autorisation a été annulée ou a expiré."}</p>
            <p style="color: #94a3b8; font-size: 0.875rem;">Vous pouvez fermer cette page et relancer le script.</p>
          </div>
        </body>
        </html>
      `);
      server.close();
      process.exit(1);
      return;
    }

    // B. Vérification du State CSRF
    if (state !== sessionState) {
      console.error("\n❌ ERREUR DE SÉCURITÉ : Le paramètre 'state' ne correspond pas (attaque CSRF possible).");
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Erreur 403 : Paramètre de session invalide (CSRF mismatch).");
      server.close();
      process.exit(1);
      return;
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Erreur 400 : Aucun code d'autorisation reçu.");
      return;
    }

    console.log(`[OAuth 2.0] 📥 Code d'autorisation reçu avec succès !`);

    try {
      // Échange du code contre les jetons
      const tokenData = await exchangeCodeForTokens(code);

      const expiresIn = tokenData.expires_in || 86400;
      const tokensPayload = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type || "Bearer",
        expiresIn: expiresIn,
        expiresAt: Date.now() + expiresIn * 1000,
        refreshTokenExpiresIn: tokenData.refresh_token_expires_in,
        refreshTokenExpiresAt: tokenData.refresh_token_expires_in
          ? Date.now() + tokenData.refresh_token_expires_in * 1000
          : undefined,
        env: env,
        createdAt: new Date().toISOString(),
      };

      // 1. Sauvegarde dans .saxo_tokens.json
      fs.writeFileSync(tokensFilePath, JSON.stringify(tokensPayload, null, 2), "utf-8");
      console.log(`[Persistance] 💾 Jetons enregistrés dans ${path.basename(tokensFilePath)}`);

      // 2. Mise à jour de .env.local
      updateEnvLocal({
        SAXO_ACCESS_TOKEN: tokenData.access_token,
        ...(tokenData.refresh_token ? { SAXO_REFRESH_TOKEN: tokenData.refresh_token } : {}),
      });

      // 3. Sauvegarde directe dans Supabase (PostgreSQL) si DATABASE_URL est présent
      if (process.env.DATABASE_URL) {
        try {
          const { default: postgres } = await import("postgres");
          const sql = postgres(process.env.DATABASE_URL, { prepare: false });
          const expiresAtDate = new Date(tokensPayload.expiresAt);
          const refreshExpiresDate = tokensPayload.refreshTokenExpiresAt ? new Date(tokensPayload.refreshTokenExpiresAt) : null;

          const existing = await sql`SELECT id FROM oauth_tokens WHERE provider = 'saxo' LIMIT 1`;
          if (existing.length > 0) {
            await sql`
              UPDATE oauth_tokens
              SET
                access_token = ${tokensPayload.accessToken},
                refresh_token = ${tokensPayload.refreshToken},
                token_type = ${tokensPayload.tokenType},
                expires_at = ${expiresAtDate},
                refresh_token_expires_at = ${refreshExpiresDate},
                scope = ${tokensPayload.scope || null},
                base_uri = ${tokensPayload.baseUri || null},
                env = ${tokensPayload.env || 'live'},
                updated_at = NOW()
              WHERE id = ${existing[0].id}
            `;
            console.log("[Persistance] 🗄️ Jetons Saxo synchronisés dans la table oauth_tokens sur Supabase !");
          } else {
            await sql`
              INSERT INTO oauth_tokens (
                provider, access_token, refresh_token, token_type, expires_at, refresh_token_expires_at, scope, base_uri, env
              ) VALUES (
                'saxo', ${tokensPayload.accessToken}, ${tokensPayload.refreshToken}, ${tokensPayload.tokenType},
                ${expiresAtDate}, ${refreshExpiresDate}, ${tokensPayload.scope || null}, ${tokensPayload.baseUri || null}, ${tokensPayload.env || 'live'}
              )
            `;
            console.log("[Persistance] 🗄️ Jetons Saxo insérés dans la table oauth_tokens sur Supabase !");
          }
          await sql.end();
        } catch (dbErr) {
          console.warn("[Persistance] ⚠️ Impossible d'écrire dans Supabase :", dbErr.message);
        }
      }

      // Page de confirmation visuelle
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <title>Connexion Saxo Réussie</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #090d16; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0f172a; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #10b981; max-width: 540px; text-align: center; box-shadow: 0 25px 50px -12px rgba(16, 185, 129, 0.25); }
            h1 { color: #34d399; margin-top: 0; font-size: 1.75rem; }
            .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 600; font-size: 0.75rem; margin-bottom: 1rem; }
            p { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; }
            code { background: #1e293b; color: #e2e8f0; padding: 0.2rem 0.4rem; border-radius: 0.375rem; font-size: 0.85rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Saxo OpenAPI</span>
            <h1>🎉 Authentification Réussie !</h1>
            <p>Vos jetons d'accès (<strong>Access Token</strong> & <strong>Refresh Token</strong>) ont été générés et sauvegardés avec succès dans votre application Sousous.</p>
            <p>Le renouvellement quotidien automatique est désormais actif.</p>
            <p style="color: #64748b; font-size: 0.8rem; margin-top: 1.5rem;">Vous pouvez fermer cet onglet en toute sécurité.</p>
          </div>
        </body>
        </html>
      `);

      console.log("\n==================================================================");
      console.log("🏆 AUTHENTIFICATION INITIALE TERMINÉE AVEC SUCCÈS !");
      console.log("==================================================================");
      console.log(`🔑 Access Token  : ${tokenData.access_token.slice(0, 20)}...${tokenData.access_token.slice(-10)}`);
      if (tokenData.refresh_token) {
        console.log(`🔄 Refresh Token : ${tokenData.refresh_token.slice(0, 10)}...`);
      }
      console.log(`⏳ Durée de vie  : ${expiresIn} secondes (~${Math.round(expiresIn / 3600)} heures)`);
      console.log("==================================================================\n");

      // Fermeture propre du serveur
      setTimeout(() => {
        server.close(() => {
          console.log("🛑 Serveur temporaire arrêté proprement. Vous pouvez maintenant lancer l'application !");
          process.exit(0);
        });
      }, 1000);

    } catch (err) {
      console.error("\n❌ Erreur lors de l'échange du token :", err.message);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Erreur 500 : ${err.message}`);
      server.close();
      process.exit(1);
    }
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

// Démarrage du serveur et ouverture du navigateur
server.listen(serverPort, () => {
  console.log(`🚀 Serveur d'écoute local démarré sur : http://localhost:${serverPort}`);
  console.log(`\n🌐 Ouverture de la page de connexion Saxo dans votre navigateur...`);
  console.log(`Si la page ne s'ouvre pas automatiquement, cliquez sur ce lien :\n`);
  console.log(`👉 ${authRedirectUrl.toString()}\n`);

  openBrowser(authRedirectUrl.toString());
});

// Gestion des arrêts manuels (Ctrl+C)
process.on("SIGINT", () => {
  console.log("\n🛑 Arrêt manuel du serveur.");
  server.close();
  process.exit(0);
});
