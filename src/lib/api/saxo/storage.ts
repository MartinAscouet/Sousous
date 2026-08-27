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

/**
 * Adaptateur de stockage de tokens en base de données PostgreSQL (Supabase)
 * 100% compatible Vercel Serverless & multi-instances
 */
export class DatabaseTokenStorage implements ITokenStorage {
  private provider: string;
  private userId?: string;

  constructor(provider = "saxo", userId?: string) {
    this.provider = provider;
    this.userId = userId;
  }

  public async loadTokens(): Promise<SaxoOAuthTokens | null> {
    try {
      console.log(`[DatabaseTokenStorage] 🔍 Recherche de tokens en base Supabase pour provider='${this.provider}'...`);
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

      if (!rows || rows.length === 0) {
        console.log(`[DatabaseTokenStorage] ℹ️ Aucun token trouvé en base pour provider='${this.provider}'.`);
        return null;
      }

      const row = rows[0];
      const now = Date.now();
      const expiresAt = row.expiresAt.getTime();
      const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));

      console.log(`[DatabaseTokenStorage] ✅ Tokens trouvés en base Supabase pour '${this.provider}' (env: ${row.env}, expire dans: ${expiresIn}s)`);

      const tokens: SaxoOAuthTokens = {
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

      return tokens;
    } catch (err: unknown) {
      console.error("[DatabaseTokenStorage] ❌ Erreur lors de la lecture des tokens en base :", (err as Error).message);
      return null;
    }
  }

  public async saveTokens(tokens: SaxoOAuthTokens): Promise<void> {
    try {
      console.log(`[DatabaseTokenStorage] 💾 Sauvegarde des tokens pour provider='${this.provider}'...`);
      const conditions = [eq(oauthTokens.provider, this.provider)];
      if (this.userId) {
        conditions.push(eq(oauthTokens.userId, this.userId));
      }

      const existing = await db
        .select({ id: oauthTokens.id })
        .from(oauthTokens)
        .where(and(...conditions))
        .limit(1);

      const expiresAt = new Date(tokens.expiresAt);
      const refreshTokenExpiresAt = tokens.refreshTokenExpiresAt
        ? new Date(tokens.refreshTokenExpiresAt)
        : null;

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
        console.log(`[DatabaseTokenStorage] 💾 Tokens ${this.provider} mis à jour en base de données Supabase.`);
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
        console.log(`[DatabaseTokenStorage] 💾 Tokens ${this.provider} enregistrés en base de données Supabase.`);
      }
    } catch (err: unknown) {
      console.error("[DatabaseTokenStorage] ❌ Erreur lors de la sauvegarde des tokens en base :", (err as Error).message);
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

    // 3. Fallback sur les variables d'environnement initiales
    const envAccessToken = process.env.SAXO_ACCESS_TOKEN;
    const envRefreshToken = process.env.SAXO_REFRESH_TOKEN;

    if (envAccessToken || envRefreshToken) {
      console.log("[CompositeTokenStorage] ⚙️ Tokens chargés depuis les variables d'environnement (SAXO_ACCESS_TOKEN / SAXO_REFRESH_TOKEN).");
      const defaultTokens: SaxoOAuthTokens = {
        accessToken: envAccessToken || "",
        refreshToken: envRefreshToken || "",
        tokenType: "Bearer",
        expiresIn: 86400, // 24h par défaut
        expiresAt: Date.now() + 86400 * 1000,
        env: (process.env.SAXO_ENV as SaxoEnvironment) || "live",
      };
      // Sauvegarder automatiquement en base pour persister
      await this.dbStorage.saveTokens(defaultTokens).catch(() => {});
      return defaultTokens;
    }

    console.warn("[CompositeTokenStorage] ⚠️ Aucun token trouvé (ni en base Supabase, ni en fichier local, ni dans process.env).");
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
