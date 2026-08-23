/**
 * Script de test et démonstration de gestion automatique des tokens OAuth 2.0 Saxo
 * Exécution : node scripts/saxo_test_auth.mjs
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chargement des variables d'environnement
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const TOKENS_FILE = path.join(__dirname, "..", ".saxo_tokens.json");

// 1. Classe de gestion des tokens OAuth 2.0
class SaxoTokenService {
  constructor() {
    this.appKey = process.env.SAXO_APP_KEY;
    this.appSecret = process.env.SAXO_APP_SECRET;
    this.env = (process.env.SAXO_ENV || "live").toLowerCase() === "sim" ? "sim" : "live";
    this.safetyMarginMs = 5 * 60 * 1000; // 5 minutes de marge avant expiration
    this.tokens = this.loadTokensFromDisk();
  }

  getAuthBaseUrl() {
    return this.env === "sim"
      ? "https://sim.logonvalidation.net"
      : "https://live.logonvalidation.net";
  }

  getGatewayBaseUrl() {
    return this.env === "sim"
      ? "https://gateway.saxobank.com/sim/openapi"
      : "https://gateway.saxobank.com/openapi";
  }

  loadTokensFromDisk() {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"));
        console.log(`[TokenService] 📂 Fichier de tokens trouvé (${path.basename(TOKENS_FILE)})`);
        return data;
      }
    } catch (e) {
      console.warn("[TokenService] ⚠️ Erreur lecture fichier token :", e.message);
    }

    return {
      accessToken: process.env.SAXO_ACCESS_TOKEN || "",
      refreshToken: process.env.SAXO_REFRESH_TOKEN || "",
      expiresAt: Date.now() + 24 * 3600 * 1000, // 24h
    };
  }

  saveTokensToDisk(tokens) {
    this.tokens = tokens;
    try {
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
      console.log(`[TokenService] 💾 Nouveaux tokens persistés dans ${path.basename(TOKENS_FILE)}`);
    } catch (e) {
      console.error("[TokenService] ❌ Erreur écriture tokens :", e.message);
    }
  }

  isExpired() {
    if (!this.tokens?.accessToken) return true;
    const now = Date.now();
    const expiresAt = this.tokens.expiresAt || 0;
    return now >= expiresAt - this.safetyMarginMs;
  }

  async refreshAccessToken() {
    const refreshToken = this.tokens?.refreshToken || process.env.SAXO_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error("Impossible de rafraîchir : aucun SAXO_REFRESH_TOKEN disponible.");
    }
    if (!this.appKey || !this.appSecret) {
      throw new Error("SAXO_APP_KEY et SAXO_APP_SECRET manquants dans .env.");
    }

    const tokenUrl = `${this.getAuthBaseUrl()}/token`;
    console.log(`\n[TokenService] 🔄 Renouvellement du token OAuth 2.0 via POST ${tokenUrl}...`);

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const basicAuth = Buffer.from(`${this.appKey}:${this.appSecret}`).toString("base64");

    const res = await fetch(tokenUrl, {
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
      throw new Error(`Échec refresh token [${res.status}] : ${data.error_description || data.error || res.statusText}`);
    }

    const expiresIn = data.expires_in || 86400;
    const updated = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Rotation de refresh token si fournie
      tokenType: data.token_type || "Bearer",
      expiresIn: expiresIn,
      expiresAt: Date.now() + expiresIn * 1000,
      updatedAt: new Date().toISOString(),
    };

    this.saveTokensToDisk(updated);
    console.log(`[TokenService] ✅ Jeton rafraîchi avec succès ! Valide jusqu'à : ${new Date(updated.expiresAt).toLocaleString("fr-FR")}`);
    return updated.accessToken;
  }

  async getValidAccessToken() {
    if (this.isExpired()) {
      console.log("[TokenService] ⏳ Le jeton d'accès actuel est expiré ou proche de l'expiration (< 5 min).");
      return await this.refreshAccessToken();
    }
    console.log("[TokenService] ⚡ Le jeton d'accès actuel en cache est encore valide.");
    return this.tokens.accessToken;
  }

  // 2. Fetch wrapper avec injection d'Authorization et gestion du retry 401
  async fetchProtected(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${this.getGatewayBaseUrl()}${endpoint}`;
    let token = await this.getValidAccessToken();

    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };

    let res = await fetch(url, { ...options, headers });

    // Interception 401 Unauthorized
    if (res.status === 401) {
      console.warn(`[TokenService] ⚠️ 401 Unauthorized reçu sur ${endpoint}. Tentative de refresh immédiat...`);
      token = await this.refreshAccessToken();
      headers["Authorization"] = `Bearer ${token}`;
      res = await fetch(url, { ...options, headers });
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Erreur API Saxo [${res.status}] : ${errBody.Message || errBody.error || res.statusText}`);
    }

    return await res.json();
  }
}

// 3. Démonstration
async function main() {
  console.log("===============================================================");
  console.log("🔐 TEST DU GESTIONNAIRE DE TOKENS OAUTH 2.0 SAXO OPENAPI");
  console.log("===============================================================\n");

  const service = new SaxoTokenService();

  if (!process.env.SAXO_APP_KEY) {
    console.log("ℹ️ Aucune clé SAXO_APP_KEY configurée pour le moment.");
    console.log("Configurez SAXO_APP_KEY, SAXO_APP_SECRET et SAXO_REFRESH_TOKEN dans .env.local.");
    return;
  }

  try {
    console.log("1. Récupération d'un token valide...");
    const token = await service.getValidAccessToken();
    console.log(`🔑 Token actif : ${token.slice(0, 15)}...${token.slice(-10)}`);

    console.log("\n2. Exécution d'un appel API protégé (/port/v1/accounts/me)...");
    const accounts = await service.fetchProtected("/port/v1/accounts/me");

    console.log("✅ Données reçues avec succès :");
    console.log(JSON.stringify(accounts, null, 2));

  } catch (err) {
    console.error("❌ Erreur :", err.message);
  }
}

main();
