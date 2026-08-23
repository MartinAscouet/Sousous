import fs from "fs";
import path from "path";
import { ITokenStorage, SaxoOAuthTokens } from "./types";

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
      console.error("[FileTokenStorage] ❌ Erreur lors de l'écriture des tokens :", err);
    }
  }

  public async clearTokens(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (err) {
      console.warn("[FileTokenStorage] ⚠️ Erreur lors de la suppression :", err);
    }
  }
}

/**
 * Adaptateur combiné : Lit en priorité le fichier de token persistant,
 * sinon utilise les variables d'environnement initiales (.env) et sauvegarde les nouveaux tokens.
 */
export class CompositeTokenStorage implements ITokenStorage {
  private fileStorage: FileTokenStorage;

  constructor(filePath?: string) {
    this.fileStorage = new FileTokenStorage(filePath);
  }

  public async loadTokens(): Promise<SaxoOAuthTokens | null> {
    // 1. Essayer le fichier JSON persistant (contient les derniers tokens rafraîchis)
    const fileTokens = await this.fileStorage.loadTokens();
    if (fileTokens && fileTokens.accessToken) {
      return fileTokens;
    }

    // 2. Fallback sur les variables d'environnement initiales
    const envAccessToken = process.env.SAXO_ACCESS_TOKEN;
    const envRefreshToken = process.env.SAXO_REFRESH_TOKEN;

    if (envAccessToken || envRefreshToken) {
      return {
        accessToken: envAccessToken || "",
        refreshToken: envRefreshToken || "",
        tokenType: "Bearer",
        expiresIn: 86400, // 24h par défaut
        expiresAt: Date.now() + 86400 * 1000,
      };
    }

    return null;
  }

  public async saveTokens(tokens: SaxoOAuthTokens): Promise<void> {
    await this.fileStorage.saveTokens(tokens);
  }

  public async clearTokens(): Promise<void> {
    await this.fileStorage.clearTokens();
  }
}
