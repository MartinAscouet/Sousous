import { NextRequest, NextResponse } from "next/server";
import { MeriaClient, MeriaApiError } from "@/lib/api/crypto/meria";
import { CryptoPortfolioService } from "@/lib/api/crypto/service";

export const dynamic = "force-dynamic";

/**
 * Route API pour interroger les soldes et positions Meria
 * GET /api/crypto/meria
 */
export async function GET(request: NextRequest) {
  try {
    // Possibilité de passer la clé API via le header de requête ou d'utiliser celle de l'environnement
    const customApiKey = request.headers.get("x-meria-api-key");
    const apiKey = customApiKey || process.env.MERIA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Clé API Meria non configurée. Veuillez renseigner MERIA_API_KEY dans votre fichier .env.local ou fournir le header x-meria-api-key.",
          code: "MISSING_API_KEY",
        },
        { status: 400 }
      );
    }

    const client = new MeriaClient(apiKey);
    const summary = await client.getAccountSummary("Meria");
    const enrichedSummary = await CryptoPortfolioService.enrichWithPrices(summary);



    // Calcul des statistiques de synthèse (faits marquants)
    let totalWallet = 0;
    let totalStaking = 0;
    let totalLending = 0;

    enrichedSummary.positions.forEach((pos) => {
      totalWallet += pos.walletBalance;
      totalStaking += pos.stakingBalance;
      totalLending += pos.lendingBalance;
    });

    return NextResponse.json({
      success: true,
      account: enrichedSummary,
      highlights: {
        activePositionsCount: enrichedSummary.activePositionsCount,
        totalEstimatedValueEur: enrichedSummary.totalValueEur,
        assetsWithStaking: enrichedSummary.positions.filter((p) => p.stakingBalance > 0).length,
        assetsWithLending: enrichedSummary.positions.filter((p) => p.lendingBalance > 0).length,
        assetsWithSpot: enrichedSummary.positions.filter((p) => p.walletBalance > 0).length,
      },
    });
  } catch (error) {
    if (error instanceof MeriaApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.statusCode === 401 || error.statusCode === 403 ? "AUTH_ERROR" : "API_ERROR",
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Une erreur inattendue est survenue lors de la récupération des données Meria.",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
