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
    console.log("[Saxo API Route] 🚀 Requête GET /api/investments/saxo reçue...");
    const searchParams = request.nextUrl.searchParams;
    const accountKey = searchParams.get("accountKey") || undefined;
    const forceRefresh = searchParams.get("force") === "true";

    const now = Date.now();
    if (!forceRefresh && cachedData && now - lastFetchTimestamp < CACHE_TTL_MS) {
      console.log("[Saxo API Route] ⚡ Retour des données depuis le cache mémoire.");
      return NextResponse.json(cachedData);
    }

    if (inFlightPromise) {
      console.log("[Saxo API Route] ⏳ Partage de la promesse en vol...");
      const data = await inFlightPromise;
      return NextResponse.json(data);
    }

    inFlightPromise = (async () => {
      console.log("[Saxo API Route] 📡 Initialisation du client SaxoClient...");
      const client = new SaxoClient();

      // Récupération de tous les comptes pour information
      const accounts = await client.getAccounts().catch((err) => {
        console.warn("[Saxo API Route] ⚠️ Impossible de lister tous les comptes :", err.message);
        return [];
      });

      console.log("[Saxo API Route] 🏦 Récupération de la synthèse PEA...");
      const peaSummary = await client.getPeaSummary(accountKey);

      console.log(`[Saxo API] 📊 Synthèse PEA récupérée avec succès :`);
      console.log(`[Saxo API] 🏦 Compte N° ${peaSummary.accountId} (${peaSummary.displayName})`);
      console.log(`[Saxo API] 💶 Liquidités (Cash) : ${peaSummary.cashBalance} ${peaSummary.currency}`);
      console.log(`[Saxo API] 📈 Actions / Titres  : ${peaSummary.positionsValue} ${peaSummary.currency}`);
      console.log(`[Saxo API] 💰 Valorisation Totale : ${peaSummary.totalValue} ${peaSummary.currency}`);

      const responsePayload = {
        success: true,
        pea: peaSummary,
        environment: process.env.SAXO_ENV || "live",
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
    console.error("[Saxo API Route] ❌ Exception capturée dans /api/investments/saxo :", error);
    if (error instanceof SaxoApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errorCode: error.errorCode || "SAXO_API_ERROR",
          statusCode: error.statusCode || 500,
          details: error.responseBody,
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
