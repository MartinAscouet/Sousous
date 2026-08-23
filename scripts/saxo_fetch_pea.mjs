/**
 * Script de test et démonstration CLI pour Saxo OpenAPI
 * Exécution : node scripts/saxo_fetch_pea.mjs
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chargement des variables d'environnement depuis .env.local puis .env
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function run() {
  console.log("\n=======================================================");
  console.log("🏦 [SAXO OPENAPI] Récupération du Solde & Portefeuille PEA");
  console.log("=======================================================\n");

  const appKey = process.env.SAXO_APP_KEY;
  const appSecret = process.env.SAXO_APP_SECRET;
  const accessToken = process.env.SAXO_ACCESS_TOKEN;
  const refreshToken = process.env.SAXO_REFRESH_TOKEN;
  const env = (process.env.SAXO_ENV || "live").toLowerCase() === "sim" ? "sim" : "live";
  const targetAccountKey = process.env.SAXO_ACCOUNT_KEY;

  if (!appKey && !accessToken) {
    console.error("❌ ERREUR : Aucune variable d'environnement Saxo trouvée.");
    console.log("Veuillez renseigner dans votre fichier .env ou .env.local :");
    console.log("  - SAXO_APP_KEY");
    console.log("  - SAXO_APP_SECRET");
    console.log("  - SAXO_ACCESS_TOKEN (ou SAXO_REFRESH_TOKEN)");
    console.log("  - SAXO_ENV (live ou sim)");
    process.exit(1);
  }

  console.log(`📡 Environnement sélectionné : [${env.toUpperCase()}]`);

  const gatewayUrl = env === "sim"
    ? "https://gateway.saxobank.com/sim/openapi"
    : "https://gateway.saxobank.com/openapi";

  const authUrl = env === "sim"
    ? "https://sim.logonvalidation.net/token"
    : "https://live.logonvalidation.net/token";

  let currentAccessToken = accessToken;

  // 1. Fonction de rafraîchissement si nécessaire
  async function refresh(token) {
    console.log("🔄 Tentative de rafraîchissement du token OAuth 2.0...");
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token,
      client_id: appKey,
      client_secret: appSecret,
    });

    const res = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Échec du refresh token (${res.status}) : ${errText}`);
    }

    const data = await res.json();
    console.log("✅ Nouveau jeton d'accès obtenu avec succès !");
    return data.access_token;
  }

  // 2. Fonction d'appel API avec gestion du 401
  async function apiCall(endpoint) {
    const url = `${gatewayUrl}${endpoint}`;
    let res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${currentAccessToken}`,
        Accept: "application/json",
      },
    });

    if (res.status === 401 && refreshToken && appKey && appSecret) {
      console.warn("⚠️ Token 401 expiré. Renouvellement automatique...");
      currentAccessToken = await refresh(refreshToken);
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${currentAccessToken}`,
          Accept: "application/json",
        },
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erreur API Saxo [${res.status}] sur ${endpoint} : ${errText}`);
    }

    return await res.json();
  }

  try {
    // 3. Récupération des comptes
    console.log("📋 Récupération de la liste des comptes...");
    const accountsData = await apiCall("/port/v1/accounts/me");
    const accounts = accountsData.Data || [];

    console.log(`✅ ${accounts.length} compte(s) trouvé(s) sur votre profil.`);
    accounts.forEach((acc, idx) => {
      console.log(`   [${idx + 1}] ID: ${acc.AccountId} | Type: ${acc.AccountType} | Devise: ${acc.Currency} | Key: ${acc.AccountKey}`);
    });

    // 4. Identification du compte PEA
    let peaAccount = null;
    if (targetAccountKey) {
      peaAccount = accounts.find((a) => a.AccountKey === targetAccountKey || a.AccountId === targetAccountKey);
    }
    if (!peaAccount) {
      peaAccount = accounts.find(
        (a) =>
          (a.DisplayName && a.DisplayName.toUpperCase().includes("PEA")) ||
          (a.AccountId && a.AccountId.toUpperCase().includes("PEA")) ||
          a.AccountType === "Savings" ||
          a.Currency === "EUR"
      );
    }
    if (!peaAccount) peaAccount = accounts[0];

    console.log(`\n🎯 Compte PEA sélectionné : ${peaAccount.AccountId} (${peaAccount.DisplayName || peaAccount.AccountType})`);

    // 5. Récupération du solde et valorisation
    console.log("📊 Interrogation des soldes et valorisations...");
    const balance = await apiCall(`/port/v1/balances?AccountKey=${encodeURIComponent(peaAccount.AccountKey)}&ClientKey=${encodeURIComponent(peaAccount.ClientKey)}`);

    const currency = balance.Currency || peaAccount.Currency || "EUR";
    const cash = Number(balance.CashBalance || 0);
    const positions = Number(balance.NonMarginPositionsValue || 0);
    const total = Number(balance.TotalValue || 0);

    const formatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency });

    console.log("\n=======================================================");
    console.log(`🌟 SYNTHÈSE DU COMPTE PEA : ${peaAccount.AccountId}`);
    console.log("=======================================================");
    console.log(`💶 Liquidités disponibles (Cash) : ${formatter.format(cash)}`);
    console.log(`📈 Portefeuille d'actions/titres : ${formatter.format(positions)}`);
    console.log(`🏆 VALEUR TOTALE DU PEA          : ${formatter.format(total)}`);
    console.log("=======================================================\n");

  } catch (error) {
    console.error("❌ Erreur lors de l'exécution :", error.message);
  }
}

run();
