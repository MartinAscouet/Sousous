export interface CryptoPrice {
  id: string;
  priceEur: number;
  change24hEur?: number;
  lastUpdated: string;
}

/**
 * Service API CoinGecko avec mise en cache et respect du plan gratuit (Rate limit handling).
 * Utile pour récupérer les cours Bitcoin, Ethereum, Solana, etc.
 */
export async function getCryptoPrice(coinId: string): Promise<CryptoPrice | null> {
  const prices = await getMultipleCryptoPrices([coinId]);
  return prices[coinId] || null;
}

/**
 * Récupère le cours de plusieurs crypto-monnaies en une seule requête pour limiter le nombre d'appels API.
 */
export async function getMultipleCryptoPrices(
  coinIds: string[]
): Promise<Record<string, CryptoPrice>> {
  if (coinIds.length === 0) return {};

  const apiKey = process.env.COINGECKO_API_KEY;
  const baseUrl = "https://api.coingecko.com/api/v3";
  const idsParam = coinIds.join(",");

  const headers: Record<string, string> = {
    accept: "application/json",
  };

  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
  }

  const url = `${baseUrl}/simple/price?ids=${encodeURIComponent(
    idsParam
  )}&vs_currencies=eur&include_24hr_change=true`;

  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 300 }, // Cache Next.js pendant 5 minutes (300 secondes)
    });

    if (response.status === 429) {
      return {};
    }

    if (!response.ok) {
      return {};
    }

    const data: Record<
      string,
      { eur?: number; eur_24h_change?: number }
    > = await response.json();

    const result: Record<string, CryptoPrice> = {};

    Object.entries(data).forEach(([id, value]) => {
      if (typeof value.eur === "number") {
        result[id] = {
          id,
          priceEur: value.eur,
          change24hEur: value.eur_24h_change,
          lastUpdated: new Date().toISOString(),
        };
      }
    });

    return result;
  } catch {
    return {};
  }
}
