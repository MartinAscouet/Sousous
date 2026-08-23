import { NextRequest, NextResponse } from "next/server";
import { recordAllSnapshots } from "@/lib/api/performance/snapshot-service";

export const dynamic = "force-dynamic";

/**
 * Route sécurisée CRON pour la prise de snapshot automatique périodique
 * URL: /api/cron/snapshot
 * Authentification: Header 'Authorization: Bearer <CRON_SECRET>' ou query '?secret=<CRON_SECRET>'
 */
export async function GET(request: NextRequest) {
  return handleSnapshotRequest(request);
}

export async function POST(request: NextRequest) {
  return handleSnapshotRequest(request);
}

async function handleSnapshotRequest(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const searchParams = request.nextUrl.searchParams;
    const querySecret = searchParams.get("secret");

    // Validation du secret si configuré
    if (cronSecret) {
      const isHeaderValid = authHeader === `Bearer ${cronSecret}`;
      const isQueryValid = querySecret === cronSecret;

      if (!isHeaderValid && !isQueryValid) {
        return NextResponse.json(
          { success: false, error: "Non autorisé : CRON_SECRET invalide ou manquant." },
          { status: 401 }
        );
      }
    }

    const result = await recordAllSnapshots();

    return NextResponse.json({
      message: "Snapshot de valorisation enregistré avec succès.",
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: unknown) {
    console.error("[CRON Snapshot Error] :", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la capture du snapshot financier.",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
