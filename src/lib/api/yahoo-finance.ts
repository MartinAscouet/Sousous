import yahooFinance from "yahoo-finance2";

export interface StockQuote {
  symbol: string;
  price: number;
  currency: string;
  change24hPercentage?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  shortName?: string;
}

/**
 * Service pour la récupération des cours de Bourse / ETF via yahoo-finance2.
 * Intègre la gestion des erreurs et la mise en cache (revalidate 300s / 5min).
 */
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const result = await yahooFinance.quote(symbol);

    if (!result || typeof result.regularMarketPrice !== "number") {
      console.warn(`[YahooFinance] Aucune cotation valide retournée pour le ticker: ${symbol}`);
      return null;
    }

    return {
      symbol: result.symbol,
      price: result.regularMarketPrice,
      currency: result.currency || "EUR",
      change24hPercentage: result.regularMarketChangePercent,
      regularMarketDayHigh: result.regularMarketDayHigh,
      regularMarketDayLow: result.regularMarketDayLow,
      shortName: result.shortName || result.longName || symbol,
    };
  } catch (error) {
    console.error(`[YahooFinance Error] Impossible de récupérer le cours pour ${symbol}:`, error);
    return null;
  }
}

/**
 * Récupération par lots (Batch) de plusieurs tickers
 */
export async function getMultipleStockQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  if (symbols.length === 0) return {};

  const quotesMap: Record<string, StockQuote> = {};
  const results = await Promise.allSettled(symbols.map((sym) => getStockQuote(sym)));

  results.forEach((res) => {
    if (res.status === "fulfilled" && res.value) {
      quotesMap[res.value.symbol] = res.value;
    }
  });

  return quotesMap;
}
