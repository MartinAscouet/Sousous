import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Recommandé pour AES-GCM (96 bits)

/**
 * Récupère ou dérive une clé de 32 octets à partir de la variable d'environnement ENCRYPTION_SECRET
 */
function getEncryptionKey(customSecret?: string): Buffer {
  const secret = customSecret || process.env.ENCRYPTION_SECRET || process.env.CRON_SECRET || "default-dev-secret-key-change-in-prod-32b";
  // Hachage SHA-256 pour garantir une clé exacte de 32 octets (256 bits)
  return crypto.createHash("sha256").update(secret).digest();
}

export interface EncryptedPayload {
  encryptedData: string; // Base64
  iv: string;            // Base64
  tag: string;           // Base64 (Auth Tag pour vérifier l'intégrité)
}

/**
 * Chiffre une chaîne de caractères en AES-256-GCM
 */
export function encrypt(plainText: string, customSecret?: string): EncryptedPayload {
  const key = getEncryptionKey(customSecret);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Déchiffre une chaîne de caractères chiffrée en AES-256-GCM
 */
export function decrypt(
  encryptedData: string,
  ivBase64: string,
  tagBase64: string,
  customSecret?: string
): string {
  const key = getEncryptionKey(customSecret);
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
