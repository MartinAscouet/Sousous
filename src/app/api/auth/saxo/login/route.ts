import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const baseUrl = request.nextUrl.origin;
    const appKey = process.env.SAXO_APP_KEY?.replace(/^["']|["']$/g, "").trim();
    const env = (process.env.SAXO_ENV || "live").toLowerCase() === "sim" ? "sim" : "live";
    const redirectUri = `${baseUrl}/callback`;

    if (!appKey) {
      return NextResponse.json(
        {
          error: "SAXO_APP_KEY non définie dans les variables d'environnement.",
        },
        { status: 400 }
      );
    }

    const authHost = env === "sim" ? "https://sim.logonvalidation.net" : "https://live.logonvalidation.net";
    const state = crypto.randomBytes(16).toString("hex");

    const authorizeUrl = new URL(`${authHost}/authorize`);
    authorizeUrl.searchParams.append("response_type", "code");
    authorizeUrl.searchParams.append("client_id", appKey);
    authorizeUrl.searchParams.append("redirect_uri", redirectUri);
    authorizeUrl.searchParams.append("state", state);

    console.log(`[Saxo Auth Login] 🔗 Redirection vers la page d'authentification Saxo : ${authorizeUrl.toString()}`);

    return NextResponse.redirect(authorizeUrl.toString());
  } catch (err: unknown) {
    console.error("[Saxo Auth Login] ❌ Erreur :", err);
    return NextResponse.json(
      {
        error: "Impossible d'initier la connexion Saxo.",
        details: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
