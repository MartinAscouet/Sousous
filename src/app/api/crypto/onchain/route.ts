import { NextRequest, NextResponse } from "next/server";
import { fetchAllOnChainBalances, OnChainAddressQuery } from "@/lib/api/crypto/onchain";
import { getMultipleCryptoPrices } from "@/lib/api/coingecko";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: OnChainAddressQuery = await request.json();

    const balances = await fetchAllOnChainBalances(body);

    // Enrichissement prix CoinGecko optionnel
    const symbols = balances.map((b) => b.symbol.toLowerCase());
    const idMap: Record<string, string> = {
      eth: "ethereum",
      btc: "bitcoin",
      doge: "dogecoin",
      xrp: "ripple",
    };
    const coinIds = symbols.map((s) => idMap[s] || s);
    const priceMap: Record<string, { priceEur: number }> = await getMultipleCryptoPrices(coinIds).catch(() => ({}));

    const enriched = balances.map((item) => {
      const coinId = idMap[item.symbol.toLowerCase()];
      const priceData = coinId ? priceMap[coinId] : undefined;
      const priceEur = priceData ? priceData.priceEur : undefined;
      return {
        ...item,
        priceEur,
        totalValueEur: priceEur ? item.balance * priceEur : undefined,
      };
    });


    return NextResponse.json({
      success: true,
      data: enriched,
      syncDate: balances[0]?.syncDate || new Date().toLocaleString("fr-FR"),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des soldes on-chain",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queries: OnChainAddressQuery = {
    eth: searchParams.get("eth") || process.env.ETH_ADDRESS || undefined,
    btc: searchParams.get("btc") || process.env.BTC_ADDRESS || undefined,
    doge: searchParams.get("doge") || process.env.DOGE_ADDRESS || undefined,
    xrp: searchParams.get("xrp") || process.env.XRP_ADDRESS || undefined,
  };

  const hasAnyAddress = queries.eth || queries.btc || queries.doge || queries.xrp;
  if (!hasAnyAddress) {
    return NextResponse.json({
      success: true,
      data: [],
      savedAddresses: {},
      syncDate: new Date().toLocaleString("fr-FR"),
    });
  }

  const balances = await fetchAllOnChainBalances(queries);

  // Enrichissement prix CoinGecko
  const symbols = balances.map((b) => b.symbol.toLowerCase());
  const idMap: Record<string, string> = {
    eth: "ethereum",
    btc: "bitcoin",
    doge: "dogecoin",
    xrp: "ripple",
  };
  const coinIds = symbols.map((s) => idMap[s] || s);
  const priceMap: Record<string, { priceEur: number }> = await getMultipleCryptoPrices(coinIds).catch(() => ({}));

  const enriched = balances.map((item) => {
    const coinId = idMap[item.symbol.toLowerCase()];
    const priceData = coinId ? priceMap[coinId] : undefined;
    const priceEur = priceData ? priceData.priceEur : undefined;
    return {
      ...item,
      priceEur,
      totalValueEur: priceEur ? item.balance * priceEur : undefined,
    };
  });

  return NextResponse.json({
    success: true,
    data: enriched,
    savedAddresses: queries,
    syncDate: balances[0]?.syncDate || new Date().toLocaleString("fr-FR"),
  });
}

