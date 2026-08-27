import { NextRequest, NextResponse } from "next/server";
import { SaxoClient, SaxoApiError } from "@/lib/api/saxo/client";
import { DatabaseTokenStorage } from "@/lib/api/saxo/storage";

export const dynamic = "force-dynamic";

let cachedData: any = null;
let lastFetchTimestamp = 0;
let inFlightPromise: Promise<any> | null = null;
const CACHE_TTL_MS = 15 * 1000;

export async function GET(request: NextRequest) {
  const debugLogs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    debugLogs.push(msg);
  };

  try {
    log("[Saxo API Route] 🚀 Requête GET /api/investments/saxo reçue...");
    const searchParams = request.nextUrl.searchParams;
    const accountKey = searchParams.get("accountKey") || undefined;
    const forceRefresh = searchParams.get("force") === "true";

    const now = Date.now();
    if (!forceRefresh && cachedData && now - lastFetchTimestamp < CACHE_TTL_MS) {
      log("[Saxo API Route] ⚡ Retour des données depuis le cache mémoire.");
      return NextResponse.json(cachedData);
    }

    if (inFlightPromise) {
      log("[Saxo API Route] ⏳ Partage de la promesse en vol...");
      const data = await inFlightPromise;
      return NextResponse.json(data);
    }

    inFlightPromise = (async () => {
      // Diagnostic direct du stockage
      const storage = new DatabaseTokenStorage("saxo");
      const directTokens = await storage.loadTokens();
      log(`[Direct Storage Check] Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}, Tokens trouvés: ${!!directTokens}, accessToken: ${directTokens?.accessToken ? "présent (" + directTokens.accessToken.slice(0, 10) + "...)" : "aucun"}, env: ${directTokens?.env}, expiresAt: ${directTokens?.expiresAt ? new Date(directTokens.expiresAt).toISOString() : "aucun"}`);

      log("[Saxo API Route] 📡 Initialisation du client SaxoClient...");
      const client = new SaxoClient();

      // Récupération de tous les comptes
      const accounts = await client.getAccounts().catch((err) => {
        log(`[Saxo API Route] ⚠️ Erreur getAccounts: ${err.message}`);
        return [];
      });

      log("[Saxo API Route] 🏦 Récupération de la synthèse PEA...");
      const peaSummary = await client.getPeaSummary(accountKey);

      log(`[Saxo API] 📊 Synthèse PEA récupérée: ${peaSummary.totalValue} ${peaSummary.currency}`);

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
        debugLogs,
      };

      cachedData = responsePayload;
      lastFetchTimestamp = Date.now();
      return responsePayload;
    })();

    try {
      const result = await inFlightPromise;
      return NextResponse.json(result);
    } finally {
      inFlightPromise = null;
    }
  } catch (error: unknown) {
    console.error("[Saxo API Route] ❌ Exception capturée dans /api/investments/saxo :", error);
    const envInfo = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasSaxoAppKey: !!process.env.SAXO_APP_KEY,
      hasSaxoAppSecret: !!process.env.SAXO_APP_SECRET,
      saxoEnv: process.env.SAXO_ENV || "non défini",
    };

    if (error instanceof SaxoApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errorCode: error.errorCode || "SAXO_API_ERROR",
          statusCode: error.statusCode || 500,
          details: error.responseBody,
          debugLogs,
          envInfo,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Erreur inattendue lors de la communication avec Saxo OpenAPI.",
        details: (error as Error).message,
        debugLogs,
        envInfo,
      },
      { status: 500 }
    );
  }
}
