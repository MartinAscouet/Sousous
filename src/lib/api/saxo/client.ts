import {
  SaxoEnvironment,
  SaxoAccount,
  SaxoAccountsResponse,
  SaxoBalance,
  SaxoPeaSummary,
  ITokenStorage,
} from "./types";
import { SaxoTokenManager, SaxoAuthError } from "./token-manager";

export { SaxoAuthError };

export class SaxoApiError extends Error {
  statusCode?: number;
  errorCode?: string;
  responseBody?: unknown;

  constructor(message: string, statusCode?: number, errorCode?: string, responseBody?: unknown) {
    super(message);
    this.name = "SaxoApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.responseBody = responseBody;
  }
}

export interface SaxoClientOptions {
  appKey?: string;
  appSecret?: string;
  env?: SaxoEnvironment;
  accountKey?: string;
  clientKey?: string;
  tokenStorage?: ITokenStorage;
}

export class SaxoClient {
  public readonly tokenManager: SaxoTokenManager;
  private preferredAccountKey?: string;
  private preferredClientKey?: string;

  constructor(options?: SaxoClientOptions) {
    this.tokenManager = new SaxoTokenManager(
      {
        appKey: options?.appKey || process.env.SAXO_APP_KEY,
        appSecret: options?.appSecret || process.env.SAXO_APP_SECRET,
        env: options?.env || (process.env.SAXO_ENV as SaxoEnvironment) || "live",
      },
      options?.tokenStorage
    );

    this.preferredAccountKey = options?.accountKey || process.env.SAXO_ACCOUNT_KEY || undefined;
    this.preferredClientKey = options?.clientKey || process.env.SAXO_CLIENT_KEY || undefined;
  }

  /**
   * Exécute un appel HTTP authentifié sur la Saxo OpenAPI
   * Utilise automatiquement un token valide et relance la requête en cas de 401
   */
  public async fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      return await this.tokenManager.fetchWithAutoAuth<T>(endpoint, options);
    } catch (err: unknown) {
      if (err instanceof SaxoAuthError) {
        throw new SaxoApiError(err.message, err.statusCode, err.errorCode, err.details);
      }
      throw err;
    }
  }

  /**
   * 1. Récupère la liste de tous les sous-comptes de l'utilisateur
   * GET /port/v1/accounts/me
   */
  public async getAccounts(): Promise<SaxoAccount[]> {
    const res = await this.fetchWithAuth<SaxoAccountsResponse>("/port/v1/accounts/me");
    return res.Data || [];
  }

  /**
   * 2. Récupère le solde et la valorisation d'un compte spécifique
   * GET /port/v1/balances?AccountKey={accountKey}&ClientKey={clientKey}
   */
  public async getBalances(accountKey: string, clientKey?: string): Promise<SaxoBalance> {
    let endpoint = `/port/v1/balances?AccountKey=${encodeURIComponent(accountKey)}`;
    if (clientKey) {
      endpoint += `&ClientKey=${encodeURIComponent(clientKey)}`;
    }

    return await this.fetchWithAuth<SaxoBalance>(endpoint);
  }

  /**
   * 3. Détecte et sélectionne automatiquement le compte PEA
   */
  public async getPeaAccount(targetAccountKey?: string): Promise<SaxoAccount> {
    const accounts = await this.getAccounts();

    if (!accounts || accounts.length === 0) {
      throw new SaxoApiError("Aucun compte bancaire / titres trouvé sur ce profil Saxo.", 404);
    }

    // A. Si un AccountKey spécifique a été passé en paramètre ou configuré dans le .env
    const desiredKey = targetAccountKey || this.preferredAccountKey;
    if (desiredKey) {
      const matched = accounts.find((acc) => acc.AccountKey === desiredKey || acc.AccountId === desiredKey);
      if (matched) return matched;
    }

    // B. Heuristique de détection du PEA :
    // 1) Nom d'affichage ou AccountId contenant "PEA"
    const peaByName = accounts.find(
      (acc) =>
        (acc.DisplayName && acc.DisplayName.toUpperCase().includes("PEA")) ||
        (acc.AccountId && acc.AccountId.toUpperCase().includes("PEA"))
    );
    if (peaByName) return peaByName;

    // 2) Type de compte "Savings" en devise EUR (utilisé par Saxo France pour le PEA)
    const peaByType = accounts.find(
      (acc) => acc.AccountType === "Savings" && (acc.Currency === "EUR" || !acc.Currency)
    );
    if (peaByType) return peaByType;

    // 3) Premier compte en EUR
    const eurAccount = accounts.find((acc) => acc.Currency === "EUR");
    if (eurAccount) return eurAccount;

    // Fallback : premier compte actif
    return accounts[0];
  }

  /**
   * 4. Synthèse complète du PEA (Solde liquidités + Valorisation portefeuille)
   */
  public async getPeaSummary(targetAccountKey?: string): Promise<SaxoPeaSummary> {
    const peaAccount = await this.getPeaAccount(targetAccountKey);
    const balance = await this.getBalances(peaAccount.AccountKey, peaAccount.ClientKey);

    return {
      accountKey: peaAccount.AccountKey,
      clientKey: peaAccount.ClientKey,
      accountId: peaAccount.AccountId,
      displayName: peaAccount.DisplayName || "Plan d'Épargne en Actions (Saxo)",
      accountType: peaAccount.AccountType,
      currency: balance.Currency || peaAccount.Currency || "EUR",
      cashBalance: Number(balance.CashBalance || 0),
      positionsValue: Number(balance.NonMarginPositionsValue || 0),
      totalValue: Number(balance.TotalValue || 0),
      lastUpdated: new Date().toISOString(),
    };
  }
}
