import {
  CryptoPosition,
  CryptoAccountSummary,
  MeriaWalletItem,
  MeriaStakingItem,
  MeriaLendingItem,
  MeriaMasternodeItem,
} from "./types";

const MERIA_BASE_URL = "https://api.meria.com/v1";

export class MeriaApiError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "MeriaApiError";
    this.statusCode = statusCode;
  }
}

/**
 * Normalise l'extraction d'un symbole crypto (ex: "BTC", "ETH", "SOL")
 */
function extractSymbol(item: Record<string, unknown>): string | null {
  const raw =
    item.currencyCode ||
    item.currency_code ||
    item.currency ||
    item.symbol ||
    item.asset ||
    item.coin ||
    item.ticker ||
    item.crypto ||
    item.name ||
    item.id;
  if (!raw || typeof raw !== "string") return null;
  return raw.toUpperCase().trim();
}

/**
 * Convertit en nombre float de manière sécurisée
 */
function parseAmount(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    const parsed = parseFloat(val.replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Client pour l'API publique Meria (https://api.meria.com/v1)
 */
export class MeriaClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = MERIA_BASE_URL) {
    const key = apiKey || process.env.MERIA_API_KEY;
    if (!key) {
      throw new MeriaApiError("Clé API Meria manquante (MERIA_API_KEY non configurée).");
    }
    this.apiKey = key;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Effectue un appel sécurisé vers un endpoint Meria
   */
  private async fetchEndpoint<T>(endpoint: string, isOptional: boolean = false): Promise<T[]> {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "API-KEY": this.apiKey,
        },
        cache: "no-store", // Données fraîches de solde
      });

      if (response.status === 401 || response.status === 403) {
        throw new MeriaApiError(
          `Erreur d'authentification Meria (${response.status}) : Veuillez vérifier la validité de votre clé API dans les paramètres.`,
          response.status
        );
      }

      if (response.status === 404 || response.status === 204) {
        return [];
      }

      if (!response.ok) {
        if (isOptional) {
          return [];
        }
        throw new MeriaApiError(
          `Erreur lors de l'appel Meria [${endpoint}] : HTTP ${response.status} (${response.statusText})`,
          response.status
        );
      }

      const json = await response.json();
      
      // Adaptation selon la structure de réponse Meria
      if (Array.isArray(json)) {
        return json as T[];
      }
      
      if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        const keys = ["data", "result", "items", "wallets", "positions", "staking", "contracts", "lendings", "list"];
        for (const key of keys) {
          if (Array.isArray(obj[key])) {
            return obj[key] as T[];
          }
        }
        
        // Si l'objet data est directement un objet unique de position/contrat
        if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
          return [obj.data as T];
        }

        // Si l'objet est un dictionnaire { "BTC": { balance: 0.1 }, "ETH": { ... } }
        const values = Object.entries(obj).filter(([k]) => !["success", "status", "message"].includes(k));
        if (values.length > 0 && typeof values[0][1] === "object" && values[0][1] !== null) {
          const mapped = values.map(([key, val]) => ({
            currencyCode: key,
            ...(val as Record<string, unknown>),
          })) as T[];
          return mapped;
        }
      }

      return [];
    } catch (error) {
      if (error instanceof MeriaApiError) {
        throw error;
      }
      if (isOptional) {
        return [];
      }
      throw new MeriaApiError(
        `Échec de communication réseau avec l'API Meria sur ${endpoint} : ${(error as Error).message}`
      );
    }
  }

  /**
   * Récupère les soldes disponibles / spot (Wallets)
   * GET /wallets
   */
  async getWallets(): Promise<MeriaWalletItem[]> {
    const res = await this.fetchEndpoint<MeriaWalletItem>("/wallets", true);
    if (res.length === 0) {
      return this.fetchEndpoint<MeriaWalletItem>("/wallet", true);
    }
    return res;
  }

  /**
   * Récupère les positions de Staking actives
   * GET /staking ou /stakings
   */
  async getStaking(): Promise<MeriaStakingItem[]> {
    const res = await this.fetchEndpoint<MeriaStakingItem>("/staking", true);
    if (res.length === 0) {
      return this.fetchEndpoint<MeriaStakingItem>("/stakings", true);
    }
    return res;
  }

  /**
   * Récupère les positions en Lending (Documentation officielle Meria : GET /lendings)
   * GET /lendings
   */
  async getLending(): Promise<MeriaLendingItem[]> {
    const res = await this.fetchEndpoint<MeriaLendingItem>("/lendings", true);
    if (res.length === 0) {
      return this.fetchEndpoint<MeriaLendingItem>("/lending", true);
    }
    return res;
  }

  /**
   * Récupère les positions en Masternodes (optionnel)
   * GET /masternodes
   */
  async getMasternodes(): Promise<MeriaMasternodeItem[]> {
    return this.fetchEndpoint<MeriaMasternodeItem>("/masternodes", true);
  }

  /**
   * Récupère, agrège et calcule toutes les positions Meria.
   * Règle de calcul :
   * Solde Total = Solde Spot (Wallets) + Solde Staking + Solde Lending (+ Masternodes)
   * Ignore tous les soldes égaux à 0.
   */
  async getAccountSummary(accountName = "Compte Meria"): Promise<CryptoAccountSummary> {
    // Appels concurrents tolérants aux 404 (produits sans position)
    const [wallets, staking, lending, masternodes] = await Promise.all([
      this.getWallets().catch(() => []),
      this.getStaking().catch(() => []),
      this.getLending().catch(() => []),
      this.getMasternodes().catch(() => []),
    ]);

    const assetMap: Map<string, {
      wallet: number;
      staking: number;
      lending: number;
      masternodes: number;
      name?: string;
    }> = new Map();

    // Helper pour extraire les montants de différents formats de champs possibles
    const getAmount = (item: Record<string, unknown>, fields: string[]): number => {
      for (const field of fields) {
        if (item[field] !== undefined && item[field] !== null) {
          const parsed = parseAmount(item[field]);
          if (parsed > 0) return parsed;
        }
      }
      return 0;
    };

    // 1. Wallets (Spot / Disponible)
    for (const w of wallets) {
      const sym = extractSymbol(w as Record<string, unknown>);
      if (!sym) continue;
      const amt = getAmount(w as Record<string, unknown>, ["available", "balance", "amount", "free", "total", "quantity"]);
      const existing = assetMap.get(sym) || { wallet: 0, staking: 0, lending: 0, masternodes: 0 };
      existing.wallet += amt;
      assetMap.set(sym, existing);
    }

    // 2. Staking
    for (const s of staking) {
      const sym = extractSymbol(s as Record<string, unknown>);
      if (!sym) continue;
      const amt = getAmount(s as Record<string, unknown>, ["staked", "amount", "balance", "stakedAmount", "quantity", "total"]);
      const existing = assetMap.get(sym) || { wallet: 0, staking: 0, lending: 0, masternodes: 0 };
      existing.staking += amt;
      assetMap.set(sym, existing);
    }

    // 3. Lending
    for (const l of lending) {
      const sym = extractSymbol(l as Record<string, unknown>);
      if (!sym) continue;
      const amt = getAmount(l as Record<string, unknown>, ["lent", "amount", "balance", "lentAmount", "quantity", "total"]);
      const existing = assetMap.get(sym) || { wallet: 0, staking: 0, lending: 0, masternodes: 0 };
      existing.lending += amt;
      assetMap.set(sym, existing);
    }

    // 4. Masternodes
    for (const m of masternodes) {
      const sym = extractSymbol(m as Record<string, unknown>);
      if (!sym) continue;
      const amt = getAmount(m as Record<string, unknown>, ["collateral", "amount", "balance", "quantity", "total"]);
      const existing = assetMap.get(sym) || { wallet: 0, staking: 0, lending: 0, masternodes: 0 };
      existing.masternodes += amt;
      assetMap.set(sym, existing);
    }

    // Transformation en positions consolidées avec filtrage des zéros
    const positions: CryptoPosition[] = [];

    for (const [symbol, balances] of assetMap.entries()) {
      const total = balances.wallet + balances.staking + balances.lending + balances.masternodes;

      // Règle : Ignorer ou masquer les actifs dont la balance est égale à 0
      if (total <= 0.00000001) continue;

      positions.push({
        symbol,
        name: balances.name || symbol,
        walletBalance: balances.wallet,
        stakingBalance: balances.staking,
        lendingBalance: balances.lending,
        masternodesBalance: balances.masternodes > 0 ? balances.masternodes : undefined,
        totalBalance: total,
      });
    }

    // Trier par solde total décroissant
    positions.sort((a, b) => b.totalBalance - a.totalBalance);

    return {
      id: "meria-main",
      name: accountName,
      provider: "meria",
      positions,
      activePositionsCount: positions.length,
      lastUpdated: new Date().toISOString(),
    };
  }
}
