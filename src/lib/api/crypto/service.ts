import { MeriaClient } from "./meria";
import { CryptoAccountSummary, CryptoPosition } from "./types";
import { getMultipleCryptoPrices } from "../coingecko";

// Mapping étendu des symboles crypto vers les IDs uniques CoinGecko
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  // Top cryptos & L1/L2
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  ATOM: "cosmos",
  NEAR: "near",
  SUI: "sui",
  APT: "aptos",
  SEI: "sei-network",
  TON: "the-open-network",
  TRX: "tron",
  HBAR: "hedera-hashgraph",
  ALGO: "algorand",
  EGLD: "elrond-erd-2",
  FTM: "fantom",
  S: "sonic-3",
  XTZ: "tezos",
  KSM: "kusama",
  MINA: "mina-protocol",
  ROSE: "oasis-network",
  ICP: "internet-computer",
  STX: "blockstack",
  KAS: "kaspa",

  // IA, DePIN & Big Data
  TAO: "bittensor",
  FET: "artificial-superintelligence-alliance",
  RENDER: "render-token",
  RNDR: "render-token",
  WLD: "worldcoin-wld",
  AKT: "akash-network",
  AR: "arweave",
  FIL: "filecoin",
  THETA: "theta-token",

  // Modulaires, Rollups & Ecosystème Cosmos
  TIA: "celestia",
  DYM: "dymension",
  INJ: "injective-protocol",
  OSMO: "osmosis",
  STRK: "starknet",
  ARB: "arbitrum",
  OP: "optimism",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  MANTA: "manta-network",

  // DeFi & Oracles
  LINK: "chainlink",
  PYTH: "pyth-network",
  UNI: "uniswap",
  AAVE: "aave",
  MKR: "maker",
  CRV: "curve-dao-token",
  LDO: "lido-dao",
  PENDLE: "pendle",
  ONDO: "ondo-finance",
  ENA: "ethena",
  JUP: "jupiter-exchange-solana",
  DYDX: "dydx-chain",
  GMX: "gmx",
  SNX: "havven",
  RUNE: "thorchain",

  // Gaming & Metavers
  GALA: "gala",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  RON: "ronin",
  BEAM: "beam-2",

  // Stablecoins & Devises
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  EUR: "euro",
  USD: "usd",
};


/**
 * Service centralisant la gestion de l'ensemble des comptes crypto (Meria, Binance, Ledger, etc.)
 */
export class CryptoPortfolioService {
  /**
   * Récupère les positions d'un compte Meria spécifique
   */
  static async getMeriaAccountSummary(apiKey?: string): Promise<CryptoAccountSummary> {
    const client = new MeriaClient(apiKey);
    const summary = await client.getAccountSummary("Meria");
    return this.enrichWithPrices(summary);
  }

  /**
   * Enrichit un résumé de compte avec les valorisations en Euro (CoinGecko)
   */
  static async enrichWithPrices(summary: CryptoAccountSummary): Promise<CryptoAccountSummary> {
    const symbols = summary.positions.map((p) => p.symbol);
    const coinIdsToFetch = symbols
      .map((s) => SYMBOL_TO_COINGECKO_ID[s] || s.toLowerCase())
      .filter(Boolean);

    let priceMap: Record<string, { priceEur: number }> = {};
    try {
      priceMap = await getMultipleCryptoPrices(coinIdsToFetch);
    } catch {}

    let totalAccountValueEur = 0;

    const enrichedPositions: CryptoPosition[] = summary.positions.map((pos) => {
      const coinId = SYMBOL_TO_COINGECKO_ID[pos.symbol] || pos.symbol.toLowerCase();
      const priceData = priceMap[coinId];
      const priceEur = priceData ? priceData.priceEur : undefined;
      const totalValueEur = priceEur ? pos.totalBalance * priceEur : undefined;

      if (totalValueEur) {
        totalAccountValueEur += totalValueEur;
      }

      return {
        ...pos,
        priceEur,
        totalValueEur,
      };
    });

    return {
      ...summary,
      positions: enrichedPositions,
      totalValueEur: totalAccountValueEur > 0 ? totalAccountValueEur : undefined,
    };
  }

  /**
   * Agrège plusieurs comptes crypto en une vue consolidée globale.
   * Conçu pour intégrer facilement Binance, Kraken, Ledger et d'autres comptes ultérieurement.
   */
  static aggregateAccounts(accounts: CryptoAccountSummary[]): {
    totalPositions: CryptoPosition[];
    totalValueEur?: number;
    accounts: CryptoAccountSummary[];
  } {
    const consolidatedMap: Map<string, {
      wallet: number;
      staking: number;
      lending: number;
      masternodes: number;
      priceEur?: number;
    }> = new Map();

    let grandTotalEur = 0;

    for (const acc of accounts) {
      if (acc.totalValueEur) grandTotalEur += acc.totalValueEur;

      for (const pos of acc.positions) {
        const existing = consolidatedMap.get(pos.symbol) || {
          wallet: 0,
          staking: 0,
          lending: 0,
          masternodes: 0,
          priceEur: pos.priceEur,
        };

        existing.wallet += pos.walletBalance;
        existing.staking += pos.stakingBalance;
        existing.lending += pos.lendingBalance;
        existing.masternodes += pos.masternodesBalance || 0;
        if (pos.priceEur) existing.priceEur = pos.priceEur;

        consolidatedMap.set(pos.symbol, existing);
      }
    }

    const totalPositions: CryptoPosition[] = [];
    for (const [symbol, balances] of consolidatedMap.entries()) {
      const total = balances.wallet + balances.staking + balances.lending + balances.masternodes;
      if (total <= 0) continue;

      const totalVal = balances.priceEur ? total * balances.priceEur : undefined;

      totalPositions.push({
        symbol,
        walletBalance: balances.wallet,
        stakingBalance: balances.staking,
        lendingBalance: balances.lending,
        masternodesBalance: balances.masternodes > 0 ? balances.masternodes : undefined,
        totalBalance: total,
        priceEur: balances.priceEur,
        totalValueEur: totalVal,
      });
    }

    totalPositions.sort((a, b) => (b.totalValueEur || b.totalBalance) - (a.totalValueEur || a.totalBalance));

    return {
      totalPositions,
      totalValueEur: grandTotalEur > 0 ? grandTotalEur : undefined,
      accounts,
    };
  }
}
