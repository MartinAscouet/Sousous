import { NextRequest, NextResponse } from "next/server";
import { SaxoClient, SaxoApiError } from "@/lib/api/saxo/client";

export const dynamic = "force-dynamic";

/**
 * Route GET /api/investments/saxo
 * Récupère le solde et la valorisation globale du compte PEA Saxo
 */
// Cache en mémoire court (15 secondes) pour dédupliquer les appels simultanés
let cachedData: any = null;
let lastFetchTimestamp = 0;
let inFlightPromise: Promise<any> | null = null;
const CACHE_TTL_MS = 15 * 1000; // 15s

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountKey = searchParams.get("accountKey") || undefined;
    const forceRefresh = searchParams.get("force") === "true";

    const now = Date.now();
    if (!forceRefresh && cachedData && now - lastFetchTimestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedData);
    }

    if (inFlightPromise) {
      const data = await inFlightPromise;
      return NextResponse.json(data);
    }

    inFlightPromise = (async () => {
      const client = new SaxoClient();

      // Récupération de tous les comptes pour information
      const accounts = await client.getAccounts().catch(() => []);
      const peaSummary = await client.getPeaSummary(accountKey);

      console.log(`[Saxo API] 📊 Synthèse PEA récupérée avec succès :`);
      console.log(`[Saxo API] 🏦 Compte N° ${peaSummary.accountId} (${peaSummary.displayName})`);
      console.log(`[Saxo API] 💶 Liquidités (Cash) : ${peaSummary.cashBalance} ${peaSummary.currency}`);
      console.log(`[Saxo API] 📈 Actions / Titres  : ${peaSummary.positionsValue} ${peaSummary.currency}`);
      console.log(`[Saxo API] 💰 Valorisation Totale : ${peaSummary.totalValue} ${peaSummary.currency}`);

      const responsePayload = {
        success: true,
        pea: peaSummary,
        environment: process.env.SAXO_ENV || "sim",
        allAccounts: accounts.map((acc) => ({
          accountKey: acc.AccountKey,
          accountId: acc.AccountId,
          accountType: acc.AccountType,
          currency: acc.Currency,
          displayName: acc.DisplayName,
        })),
        fetchedAt: new Date().toISOString(),
      };

      cachedData = responsePayload;
      lastFetchTimestamp = Date.now();
      return responsePayload;
    })();

    const result = await inFlightPromise;
    inFlightPromise = null;
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof SaxoApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errorCode: error.errorCode || "SAXO_API_ERROR",
          statusCode: error.statusCode || 500,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Erreur inattendue lors de la communication avec Saxo OpenAPI.",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
