import { NextRequest, NextResponse } from "next/server";
import {
  getPerformanceSummary,
  PerformancePeriod,
} from "@/lib/api/performance/snapshot-service";

export const dynamic = "force-dynamic";

/**
 * Route GET /api/performance?period=1D|1W|1M
 * Récupère les métriques de performance et variations (en € et %) pour chaque compte
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const periodParam = (searchParams.get("period") || "1D").toUpperCase();
    const period: PerformancePeriod =
      periodParam === "1W" || periodParam === "1M" ? periodParam : "1D";

    const total = Number(searchParams.get("total") || 0);
    const saxo_pea = Number(searchParams.get("saxo_pea") || searchParams.get("saxo") || 0);
    const amundi_pee = Number(searchParams.get("amundi_pee") || searchParams.get("amundi") || 0);
    const crypto = Number(searchParams.get("crypto") || 0);
    const banking = Number(searchParams.get("banking") || 0);
    const realestate = Number(searchParams.get("realestate") || 0);

    const performance = await getPerformanceSummary(period, {
      total,
      saxo_pea,
      amundi_pee,
      crypto,
      banking,
      realestate,
    });

    return NextResponse.json({
      success: true,
      performance,
    });
  } catch (error: unknown) {
    console.error("[Performance API Error] :", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors du calcul de la performance.",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
