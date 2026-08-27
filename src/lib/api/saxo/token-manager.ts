import {
  SaxoAuthConfig,
  SaxoOAuthTokens,
  SaxoRawTokenResponse,
  ITokenStorage,
} from "./types";
import { CompositeTokenStorage } from "./storage";

export class SaxoAuthError extends Error {
  public statusCode?: number;
  public errorCode?: string;
  public details?: unknown;

  constructor(message: string, statusCode?: number, errorCode?: string, details?: unknown) {
    super(message);
    this.name = "SaxoAuthError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class SaxoTokenManager {
  private config: Required<SaxoAuthConfig>;
  private storage: ITokenStorage;
  private currentTokens: SaxoOAuthTokens | null = null;
  private refreshPromise: Promise<SaxoOAuthTokens> | null = null;

  constructor(config?: Partial<SaxoAuthConfig>, storage?: ITokenStorage) {
    this.config = {
      appKey: config?.appKey || process.env.SAXO_APP_KEY || "",
      appSecret: config?.appSecret || process.env.SAXO_APP_SECRET || "",
      env: (config?.env || process.env.SAXO_ENV || "live").toLowerCase() === "sim" ? "sim" : "live",
      authMethod: config?.authMethod || "basic",
      safetyMarginSeconds: config?.safetyMarginSeconds || 300, // 5 minutes de marge de sécurité
    };

    this.storage = storage || new CompositeTokenStorage();
  }

  /**
   * Retourne l'URL du serveur d'authentification selon l'environnement (Live ou SIM)
   */
  public getAuthBaseUrl(): string {
    return this.config.env === "sim"
      ? "https://sim.logonvalidation.net"
      : "https://live.logonvalidation.net";
  }

  /**
   * Retourne l'URL de la passerelle OpenAPI selon l'environnement
   */
  public getGatewayBaseUrl(): string {
    return this.config.env === "sim"
      ? "https://gateway.saxobank.com/sim/openapi"
      : "https://gateway.saxobank.com/openapi";
  }

  /**
   * Charge les tokens en mémoire depuis le stockage persistant
   */
  private async loadTokens(): Promise<SaxoOAuthTokens | null> {
    if (!this.currentTokens) {
      console.log("[SaxoTokenManager] 🔍 Chargement initial des tokens...");
      const stored = await this.storage.loadTokens();
      if (stored) {
        // Vérification de cohérence d'environnement (ex: tokens obtenus sur SIM mais config en LIVE)
        if (stored.env && stored.env !== this.config.env) {
          console.warn(
            `[SaxoTokenManager] ⚠️ Incohérence d'environnement : Tokens enregistrés en [${stored.env}] mais application configurée en [${this.config.env}].`
          );
        }
        this.currentTokens = stored;
        console.log(`[SaxoTokenManager] 📦 Tokens en mémoire : accessToken=${stored.accessToken ? "présent" : "absent"}, refreshToken=${stored.refreshToken ? "présent" : "absent"}, expire à=${new Date(stored.expiresAt).toISOString()}`);
      } else {
        console.warn("[SaxoTokenManager] ⚠️ Aucun token disponible via le storage.");
      }
    }
    return this.currentTokens;
  }

  /**
   * Vérifie si les tokens actuels sont encore valides (hors de la marge de 5 min)
   */
  public isTokenExpired(tokens: SaxoOAuthTokens | null): boolean {
    if (!tokens || !tokens.accessToken) return true;
    if (tokens.env && tokens.env !== this.config.env) return true;
    const now = Date.now();
    const safetyMarginMs = this.config.safetyMarginSeconds * 1000;
    const isExp = now >= tokens.expiresAt - safetyMarginMs;
    return isExp;
  }

  /**
   * Obtient un Access Token valide.
   * Si le token est expiré ou proche de l'expiration (< 5 min), déclenche automatiquement le renouvellement.
   * Gère la concurrence (mutex / Promise unique) pour éviter les requêtes de refresh multiples simultanées.
   */
  public async getValidAccessToken(): Promise<string> {
    const tokens = await this.loadTokens();

    if (tokens && !this.isTokenExpired(tokens)) {
      return tokens.accessToken;
    }

    console.log("[SaxoTokenManager] ⏳ Access Token expiré ou absent. Tentative de renouvellement automatique...");
    const newTokens = await this.refreshTokens();
    return newTokens.accessToken;
  }

  /**
   * Effectue l'appel POST /token pour renouveler l'access_token à partir du refresh_token
   */
  public async refreshTokens(explicitRefreshToken?: string): Promise<SaxoOAuthTokens> {
    // Si un rafraîchissement est déjà en cours, partager la promesse en vol
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const tokens = await this.loadTokens();
        const refreshTokenToUse =
          explicitRefreshToken ||
          tokens?.refreshToken ||
          process.env.SAXO_REFRESH_TOKEN;

        console.log(`[SaxoTokenManager] 🔄 Refresh token préparé : ${refreshTokenToUse ? "présent (" + refreshTokenToUse.slice(0, 8) + "...)" : "ABSENT / NON DÉFINI"}`);
        console.log(`[SaxoTokenManager] 🔑 AppKey: ${this.config.appKey ? "définie" : "MANQUANTE"}, AppSecret: ${this.config.appSecret ? "défini" : "MANQUANT"}, Env: ${this.config.env}`);

        if (!refreshTokenToUse) {
          throw new SaxoAuthError(
            "Aucun refresh_token disponible pour le renouvellement du jeton Saxo (Veuillez vous reconnecter via /callback ou définir SAXO_REFRESH_TOKEN).",
            401,
            "REFRESH_TOKEN_MISSING"
          );
        }

        if (!this.config.appKey || !this.config.appSecret) {
          throw new SaxoAuthError(
            "SAXO_APP_KEY et SAXO_APP_SECRET sont requis dans les variables d'environnement pour renouveler les tokens Saxo.",
            400,
            "CREDENTIALS_MISSING"
          );
        }

        const tokenEndpoint = `${this.getAuthBaseUrl()}/token`;
        const bodyParams = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshTokenToUse,
        });

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        };

        // Méthode 1 : En-tête Authorization Basic base64(appKey:appSecret)
        if (this.config.authMethod === "basic") {
          const credentials = Buffer.from(`${this.config.appKey}:${this.config.appSecret}`).toString("base64");
          headers["Authorization"] = `Basic ${credentials}`;
        } else {
          // Méthode 2 : Identifiants passés dans le corps de la requête
          bodyParams.append("client_id", this.config.appKey);
          bodyParams.append("client_secret", this.config.appSecret);
        }

        console.log(`[SaxoTokenManager] 📡 Appel POST ${tokenEndpoint} (grant_type=refresh_token)...`);

        const res = await fetch(tokenEndpoint, {
          method: "POST",
          headers,
          body: bodyParams.toString(),
          cache: "no-store",
        });

        const rawData: SaxoRawTokenResponse = await res.json().catch(() => ({}) as SaxoRawTokenResponse);

        if (!res.ok) {
          const errorMsg = rawData.error_description || rawData.error || res.statusText;
          console.error(`[SaxoTokenManager] ❌ Échec de l'authentification Saxo [HTTP ${res.status}] :`, errorMsg);
          throw new SaxoAuthError(
            `Erreur OAuth 2.0 Saxo (${res.status}) : ${errorMsg}`,
            res.status,
            rawData.error || "REFRESH_FAILED",
            rawData
          );
        }

        const now = Date.now();
        const expiresInSec = rawData.expires_in || 86400; // 24h par défaut
        const updatedTokens: SaxoOAuthTokens = {
          accessToken: rawData.access_token,
          refreshToken: rawData.refresh_token || refreshTokenToUse, // Support de la rotation de refresh token
          tokenType: rawData.token_type || "Bearer",
          expiresIn: expiresInSec,
          expiresAt: now + expiresInSec * 1000,
          refreshTokenExpiresIn: rawData.refresh_token_expires_in,
          refreshTokenExpiresAt: rawData.refresh_token_expires_in
            ? now + rawData.refresh_token_expires_in * 1000
            : undefined,
          scope: rawData.scope,
          baseUri: rawData.base_uri,
          env: this.config.env,
        };

        this.currentTokens = updatedTokens;
        await this.storage.saveTokens(updatedTokens);

        const expDate = new Date(updatedTokens.expiresAt).toLocaleTimeString("fr-FR");
        console.log(`[SaxoTokenManager] ✅ Token renouvelé avec succès ! Expire à : ${expDate}`);

        return updatedTokens;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Forcer un rafraîchissement immédiat (ex. après un 401 intercepté)
   */
  public async forceRefresh(): Promise<string> {
    const newTokens = await this.refreshTokens();
    return newTokens.accessToken;
  }

  /**
   * Wrapper Fetch universel avec injection de Bearer token et gestion des 401
   */
  public async fetchWithAutoAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith("http") ? endpoint : `${this.getGatewayBaseUrl()}${endpoint}`;

    // 1. Récupération d'un token valide avant requête
    const token = await this.getValidAccessToken();

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    };

    let res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
    });

    // 2. Interception du 401 Unauthorized : tenter un rafraîchissement forcé et rejouer 1 fois
    if (res.status === 401) {
      console.warn(`[SaxoTokenManager] ⚠️ 401 reçu sur ${endpoint}. Tentative de renouvellement forcé et replay...`);
      try {
        const freshToken = await this.forceRefresh();
        headers["Authorization"] = `Bearer ${freshToken}`;

        res = await fetch(url, {
          ...options,
          headers,
          cache: "no-store",
        });
      } catch (refreshErr) {
        throw new SaxoAuthError(
          "Session Saxo expirée et renouvellement impossible. Veuillez réauthentifier l'application.",
          401,
          "SESSION_EXPIRED",
          refreshErr
        );
      }
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new SaxoAuthError(
        `Erreur API Saxo [${res.status}] : ${errorBody.Message || errorBody.error || res.statusText}`,
        res.status,
        errorBody.ErrorCode || errorBody.error,
        errorBody
      );
    }

    return (await res.json()) as T;
  }
}
