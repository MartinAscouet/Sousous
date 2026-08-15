export type CurrencyCode = "EUR" | "USD" | "GBP" | "CHF" | "BTC" | "ETH";

export type AccountType =
  | "CHECKING"       // Compte courant
  | "SAVINGS"        // Livret A, LDD, LEP, Passbook
  | "PEA"            // Plan d'Épargne en Actions
  | "CTO"            // Compte Titres Ordinaire
  | "CRYPTO_EXCHANGE"// Binance, Kraken, Coinbase
  | "CRYPTO_WALLET"  // Ledger, Metamask, Safe
  | "REAL_ESTATE"    // Immobilier physique ou SCPI
  | "OTHER";         // Prêts, métaux précieux, montres, etc.

export type AssetCategory =
  | "FIAT"           // Devises fiduciaires (EUR, USD)
  | "STOCK"          // Action individuelle (ex: Total, LVMH)
  | "ETF"            // ETF / FCP (ex: CW8, MSCI World)
  | "CRYPTO"         // Crypto-actif (ex: BTC, ETH, SOL)
  | "STABLECOIN"     // Stablecoin (ex: USDC, USDT)
  | "REAL_ESTATE"    // Actif immobilier
  | "GOLD_COMMODITY" // Métaux précieux / Matières premières
  | "OTHER";

export type TransactionType =
  | "DEPOSIT"        // Dépôt de fonds
  | "WITHDRAWAL"     // Retrait de fonds
  | "BUY"            // Achat d'actif
  | "SELL"           // Vente d'actif
  | "DIVIDEND"       // Dividende / Intérêt perçu
  | "FEE"            // Frais de gestion / courtage
  | "TRANSFER";      // Transfert entre comptes interne

export interface FinancialValuation {
  amount: string;     // Représentation exacte sous forme de chaîne pour NUMERIC(18, 8)
  currency: CurrencyCode;
  evaluatedAt: Date;
}
