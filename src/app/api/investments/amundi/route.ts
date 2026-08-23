import { NextRequest, NextResponse } from "next/server";
import { getAmundiPeeSummary, AmundiPeeSummary } from "@/lib/api/investments/amundi";

export const dynamic = "force-dynamic";

// Cache mémoire court de 5 minutes (300 secondes) pour respecter les APIs de cotation
let cachedData: AmundiPeeSummary | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 300 * 1000; // 5 min

/**
 * Route GET /api/investments/amundi
 * Récupère la valorisation du compte PEE Amundi (Actions Sopra Steria SOP.PA)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get("force") === "true";
    const customQty = searchParams.get("quantity") ? Number(searchParams.get("quantity")) : undefined;

    const now = Date.now();
    if (!forceRefresh && customQty === undefined && cachedData && now - lastFetchTime < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        source: "cache",
      });
    }

    const summary = await getAmundiPeeSummary(customQty);

    if (customQty === undefined) {
      cachedData = summary;
      lastFetchTime = Date.now();
    }

    return NextResponse.json({
      success: true,
      data: summary,
      source: "live",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la récupération de la valorisation Amundi PEE.",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
