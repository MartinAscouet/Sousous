import fs from "fs";
import path from "path";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { oauthTokens } from "@/db/schema/oauthTokens";
import { ITokenStorage, SaxoOAuthTokens, SaxoEnvironment } from "./types";

/**
 * Adaptateur de stockage de tokens dans un fichier JSON local (.saxo_tokens.json)
 */
export class FileTokenStorage implements ITokenStorage {
  private filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath || path.join(process.cwd(), ".saxo_tokens.json");
  }

  public async loadTokens(): Promise<SaxoOAuthTokens | null> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.filePath, "utf-8");
      if (!raw.trim()) return null;
      const data = JSON.parse(raw) as SaxoOAuthTokens;
      return data;
    } catch (err) {
      console.warn("[FileTokenStorage] ⚠️ Impossible de lire le fichier de tokens :", err);
      return null;
    }
  }

  public async saveTokens(tokens: SaxoOAuthTokens): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(tokens, null, 2), "utf-8");
      console.log(`[FileTokenStorage] 💾 Tokens sauvegardés dans ${path.basename(this.filePath)}`);
    } catch (err) {
      // Ignorer silencieusement si l'environnement est en lecture seule (Vercel Serverless)
      console.warn("[FileTokenStorage] ⚠️ Écriture sur disque ignorée (environnement en lecture seule) :", (err as Error).message);
    }
  }

  public async clearTokens(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (err) {
      console.warn("[FileTokenStorage] ⚠️ Erreur lors de la suppression du fichier :", err);
    }
  }
}

import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^["']|["']$/g, "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.replace(/^["']|["']$/g, "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Adaptateur de stockage de tokens en base de données PostgreSQL (Supabase)
 * 100% compatible Vercel Serverless & multi-instances (Drizzle ORM + fallback Supabase REST API)
 */
export class DatabaseTokenStorage implements ITokenStorage {
  private provider: string;
  private userId?: string;

  constructor(provider = "saxo", userId?: string) {
    this.provider = provider;
    this.userId = userId;
  }

  public async loadTokens(): Promise<SaxoOAuthTokens | null> {
    // 1. Priorité à l'API REST Supabase (HTTPS Port 443 - instantané et sans problème de pooler TCP sous Vercel)
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        let query = supabase
          .from("oauth_tokens")
          .select("*")
          .eq("provider", this.provider);

        if (this.userId) {
          query = query.eq("user_id", this.userId);
        }

        const { data, error } = await query.order("updated_at", { ascending: false }).limit(1);

        if (error) {
          console.error(`[DatabaseTokenStorage] ❌ Erreur Supabase REST (${error.code}) : ${error.message} (details: ${error.details})`);
        } else if (data && data.length > 0) {
          const row = data[0];
          const now = Date.now();
          const expiresAt = new Date(row.expires_at).getTime();
          const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));

          console.log(`[DatabaseTokenStorage] ✅ Tokens trouvés via Supabase REST pour '${this.provider}' (env: ${row.env}, expire dans: ${expiresIn}s)`);

          return {
            accessToken: row.access_token,
            refreshToken: row.refresh_token,
            tokenType: row.token_type || "Bearer",
            expiresIn,
            expiresAt,
            refreshTokenExpiresAt: row.refresh_token_expires_at ? new Date(row.refresh_token_expires_at).getTime() : undefined,
            refreshTokenExpiresIn: row.refresh_token_expires_at
              ? Math.max(0, Math.floor((new Date(row.refresh_token_expires_at).getTime() - now) / 1000))
              : undefined,
            scope: row.scope || undefined,
            baseUri: row.base_uri || undefined,
            env: (row.env as SaxoEnvironment) || undefined,
          };
        } else {
          console.warn(`[DatabaseTokenStorage] ⚠️ Aucun enregistrement trouvé dans la table oauth_tokens pour provider='${this.provider}'.`);
        }
      } else {
        console.warn("[DatabaseTokenStorage] ⚠️ Client Supabase REST non initialisable (clés manquantes).");
      }
    } catch (restErr: unknown) {
      console.warn("[DatabaseTokenStorage] ⚠️ Échec lecture Supabase REST :", (restErr as Error).message);
    }

    // 2. Fallback via Drizzle ORM (Connexion PostgreSQL)
    try {
      console.log(`[DatabaseTokenStorage] 🔍 Recherche de tokens via Drizzle pour provider='${this.provider}'...`);
      const conditions = [eq(oauthTokens.provider, this.provider)];
      if (this.userId) {
        conditions.push(eq(oauthTokens.userId, this.userId));
      }

      const rows = await db
        .select()
        .from(oauthTokens)
        .where(and(...conditions))
        .orderBy(desc(oauthTokens.updatedAt))
        .limit(1);

      if (rows && rows.length > 0) {
        const row = rows[0];
        const now = Date.now();
        const expiresAt = row.expiresAt.getTime();
        const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));

        console.log(`[DatabaseTokenStorage] ✅ Tokens trouvés via Drizzle pour '${this.provider}' (env: ${row.env}, expire dans: ${expiresIn}s)`);

        return {
          accessToken: row.accessToken,
          refreshToken: row.refreshToken,
          tokenType: row.tokenType || "Bearer",
          expiresIn,
          expiresAt,
          refreshTokenExpiresAt: row.refreshTokenExpiresAt ? row.refreshTokenExpiresAt.getTime() : undefined,
          refreshTokenExpiresIn: row.refreshTokenExpiresAt
            ? Math.max(0, Math.floor((row.refreshTokenExpiresAt.getTime() - now) / 1000))
            : undefined,
          scope: row.scope || undefined,
          baseUri: row.baseUri || undefined,
          env: (row.env as SaxoEnvironment) || undefined,
        };
      }
    } catch (drizzleErr: unknown) {
      console.warn("[DatabaseTokenStorage] ⚠️ Échec Drizzle :", (drizzleErr as Error).message);
    }

    return null;
  }

  public async saveTokens(tokens: SaxoOAuthTokens): Promise<void> {
    const expiresAt = new Date(tokens.expiresAt);
    const refreshTokenExpiresAt = tokens.refreshTokenExpiresAt
      ? new Date(tokens.refreshTokenExpiresAt)
      : null;

    // 1. Tenter la sauvegarde via Drizzle ORM
    let drizzleSaved = false;
    try {
      console.log(`[DatabaseTokenStorage] 💾 Sauvegarde des tokens via Drizzle pour provider='${this.provider}'...`);
      const conditions = [eq(oauthTokens.provider, this.provider)];
      if (this.userId) {
        conditions.push(eq(oauthTokens.userId, this.userId));
      }

      const existing = await db
        .select({ id: oauthTokens.id })
        .from(oauthTokens)
        .where(and(...conditions))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(oauthTokens)
          .set({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenType: tokens.tokenType,
            expiresAt,
            refreshTokenExpiresAt,
            scope: tokens.scope || null,
            baseUri: tokens.baseUri || null,
            env: tokens.env || null,
            updatedAt: new Date(),
          })
          .where(eq(oauthTokens.id, existing[0].id));
        console.log(`[DatabaseTokenStorage] 💾 Tokens ${this.provider} mis à jour en base via Drizzle.`);
      } else {
        await db.insert(oauthTokens).values({
          provider: this.provider,
          userId: this.userId || null,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenType: tokens.tokenType,
          expiresAt,
          refreshTokenExpiresAt,
          scope: tokens.scope || null,
          baseUri: tokens.baseUri || null,
          env: tokens.env || null,
        });
        console.log(`[DatabaseTokenStorage] 💾 Tokens ${this.provider} enregistrés en base via Drizzle.`);
      }
      drizzleSaved = true;
    } catch (drizzleErr: unknown) {
      console.warn("[DatabaseTokenStorage] ⚠️ Échec écriture Drizzle, basculement Supabase REST :", (drizzleErr as Error).message);
    }

    // 2. Si Drizzle a échoué, sauvegarder via Supabase REST API
    if (!drizzleSaved) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          console.log(`[DatabaseTokenStorage] 🌐 Sauvegarde des tokens via Supabase REST API...`);
          let query = supabase.from("oauth_tokens").select("id").eq("provider", this.provider);
          if (this.userId) query = query.eq("user_id", this.userId);
          const { data: existing } = await query.limit(1);

          if (existing && existing.length > 0) {
            await supabase
              .from("oauth_tokens")
              .update({
                access_token: tokens.accessToken,
                refresh_token: tokens.refreshToken,
                token_type: tokens.tokenType,
                expires_at: expiresAt.toISOString(),
                refresh_token_expires_at: refreshTokenExpiresAt?.toISOString() || null,
                scope: tokens.scope || null,
                base_uri: tokens.baseUri || null,
                env: tokens.env || null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing[0].id);
            console.log(`[DatabaseTokenStorage] 💾 Tokens ${this.provider} mis à jour via Supabase REST.`);
          } else {
            await supabase.from("oauth_tokens").insert({
              provider: this.provider,
              user_id: this.userId || null,
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
              token_type: tokens.tokenType,
              expires_at: expiresAt.toISOString(),
              refresh_token_expires_at: refreshTokenExpiresAt?.toISOString() || null,
              scope: tokens.scope || null,
              base_uri: tokens.baseUri || null,
              env: tokens.env || null,
            });
            console.log(`[DatabaseTokenStorage] 💾 Tokens ${this.provider} créés via Supabase REST.`);
          }
        }
      } catch (restErr: unknown) {
        console.error("[DatabaseTokenStorage] ❌ Erreur sauvegarde Supabase REST :", (restErr as Error).message);
      }
    }
  }

  public async clearTokens(): Promise<void> {
    try {
      const conditions = [eq(oauthTokens.provider, this.provider)];
      if (this.userId) {
        conditions.push(eq(oauthTokens.userId, this.userId));
      }
      await db.delete(oauthTokens).where(and(...conditions));
    } catch (err: unknown) {
      console.warn("[DatabaseTokenStorage] ⚠️ Erreur lors de la suppression en base :", (err as Error).message);
    }
  }
}

/**
 * Adaptateur combiné :
 * 1. Lit en priorité la base de données PostgreSQL (Supabase).
 * 2. Si non trouvé, tente le fichier JSON local (.saxo_tokens.json).
 * 3. Fallback sur les variables d'environnement initiales (.env).
 * Sauvegarde systématiquement en base de données et dans le fichier local si disponible.
 */
export class CompositeTokenStorage implements ITokenStorage {
  private dbStorage: DatabaseTokenStorage;
  private fileStorage: FileTokenStorage;

  constructor(filePath?: string, provider = "saxo", userId?: string) {
    this.dbStorage = new DatabaseTokenStorage(provider, userId);
    this.fileStorage = new FileTokenStorage(filePath);
  }

  public async loadTokens(): Promise<SaxoOAuthTokens | null> {
    // 1. Essayer la base de données (compatible Vercel & multi-instances)
    const dbTokens = await this.dbStorage.loadTokens();
    if (dbTokens && dbTokens.accessToken) {
      console.log("[CompositeTokenStorage] 🎯 Tokens chargés depuis Supabase Database.");
      return dbTokens;
    }

    // 2. Essayer le fichier JSON local (développement local)
    const fileTokens = await this.fileStorage.loadTokens();
    if (fileTokens && fileTokens.accessToken) {
      console.log("[CompositeTokenStorage] 📁 Tokens chargés depuis le fichier local .saxo_tokens.json.");
      // Synchroniser en base de données pour la prochaine fois
      await this.dbStorage.saveTokens(fileTokens).catch(() => {});
      return fileTokens;
    }

    console.warn("[CompositeTokenStorage] ⚠️ Aucun token trouvé (ni en base Supabase, ni en fichier local .saxo_tokens.json).");
    return null;
  }

  public async saveTokens(tokens: SaxoOAuthTokens): Promise<void> {
    await this.dbStorage.saveTokens(tokens);
    await this.fileStorage.saveTokens(tokens);
  }

  public async clearTokens(): Promise<void> {
    await this.dbStorage.clearTokens();
    await this.fileStorage.clearTokens();
  }
}
