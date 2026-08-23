/**
 * Types unifiés pour la gestion multi-comptes et multi-fournisseurs de crypto-monnaies.
 * Supporte Meria, Binance, Kraken, Ledger, Coinbase, etc.
 */

export type CryptoProvider = 
  | "meria"
  | "binance"
  | "kraken"
  | "coinbase"
  | "ledger"
  | "metamask"
  | "custom";

export interface CryptoPosition {
  symbol: string;              // ex: BTC, ETH, SOL
  name?: string;               // ex: Bitcoin, Ethereum
  walletBalance: number;       // Solde disponible / Spot (Wallets)
  stakingBalance: number;      // Montant placé en Staking
  lendingBalance: number;      // Montant placé en Lending
  masternodesBalance?: number; // Montant en Masternodes (optionnel)
  totalBalance: number;        // Total = Spot + Staking + Lending (+ Masternodes)
  priceEur?: number;           // Cours unitaire en EUR
  totalValueEur?: number;      // Valeur totale en EUR
}

export interface CryptoAccountSummary {
  id: string;
  name: string;
  provider: CryptoProvider;
  positions: CryptoPosition[];
  totalValueEur?: number;
  activePositionsCount: number;
  lastUpdated: string;
}

export interface MeriaWalletItem {
  currency?: string;
  symbol?: string;
  asset?: string;
  balance?: string | number;
  available?: string | number;
  amount?: string | number;
  [key: string]: unknown;
}

export interface MeriaStakingItem {
  currency?: string;
  symbol?: string;
  asset?: string;
  amount?: string | number;
  staked?: string | number;
  status?: string;
  [key: string]: unknown;
}

export interface MeriaLendingItem {
  currency?: string;
  symbol?: string;
  asset?: string;
  amount?: string | number;
  lent?: string | number;
  status?: string;
  [key: string]: unknown;
}

export interface MeriaMasternodeItem {
  currency?: string;
  symbol?: string;
  asset?: string;
  amount?: string | number;
  collateral?: string | number;
  status?: string;
  [key: string]: unknown;
}
