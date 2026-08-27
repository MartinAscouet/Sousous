import { NextRequest, NextResponse } from "next/server";
import { DatabaseTokenStorage } from "@/lib/api/saxo/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = request.nextUrl.origin;

  if (error) {
    console.error("[Saxo Callback] ❌ Erreur renvoyée par Saxo :", error, errorDescription);
    return NextResponse.redirect(
      new URL(`/dashboard?saxo_error=${encodeURIComponent(errorDescription || error)}`, baseUrl)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/dashboard?saxo_error=${encodeURIComponent("Aucun code d'autorisation reçu")}`, baseUrl)
    );
  }

  try {
    const appKey = process.env.SAXO_APP_KEY?.replace(/^["']|["']$/g, "").trim() || "";
    const appSecret = process.env.SAXO_APP_SECRET?.replace(/^["']|["']$/g, "").trim() || "";
    const env = (process.env.SAXO_ENV || "live").toLowerCase() === "sim" ? "sim" : "live";
    const redirectUri = `${baseUrl}/callback`;

    const authHost = env === "sim" ? "https://sim.logonvalidation.net" : "https://live.logonvalidation.net";
    const tokenEndpoint = `${authHost}/token`;

    const bodyParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: appKey,
      client_secret: appSecret,
    });

    const basicAuth = Buffer.from(`${appKey}:${appSecret}`).toString("base64");

    console.log(`[Saxo Callback] 📡 Échange du code d'autorisation auprès de ${tokenEndpoint}...`);

    const res = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      body: bodyParams.toString(),
      cache: "no-store",
    });

    const tokenData = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = tokenData.error_description || tokenData.error || res.statusText;
      console.error(`[Saxo Callback] ❌ Échec de l'échange de token [HTTP ${res.status}] :`, errorMsg);
      return NextResponse.redirect(
        new URL(`/dashboard?saxo_error=${encodeURIComponent(errorMsg)}`, baseUrl)
      );
    }

    const now = Date.now();
    const expiresIn = tokenData.expires_in || 86400;

    const storage = new DatabaseTokenStorage("saxo");
    await storage.saveTokens({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || "",
      tokenType: tokenData.token_type || "Bearer",
      expiresIn,
      expiresAt: now + expiresIn * 1000,
      refreshTokenExpiresIn: tokenData.refresh_token_expires_in,
      refreshTokenExpiresAt: tokenData.refresh_token_expires_in
        ? now + tokenData.refresh_token_expires_in * 1000
        : undefined,
      scope: tokenData.scope,
      baseUri: tokenData.base_uri,
      env: env,
    });

    console.log("[Saxo Callback] ✅ Token Saxo échangé et sauvegardé avec succès en base Supabase !");
    return NextResponse.redirect(new URL("/dashboard?saxo_success=true", baseUrl));
  } catch (err: unknown) {
    console.error("[Saxo Callback] ❌ Exception lors du callback :", err);
    return NextResponse.redirect(
      new URL(`/dashboard?saxo_error=${encodeURIComponent((err as Error).message)}`, baseUrl)
    );
  }
}
