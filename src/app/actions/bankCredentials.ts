"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { bankCredentials } from "@/db/schema";
import { encrypt } from "@/lib/encryption";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface SaveBankCredentialsInput {
  bankModule: string;
  label?: string;
  login: string;
  password: string;
}

export interface BankCredentialPublicInfo {
  id: string;
  bankModule: string;
  label: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
}

/**
 * Sauvegarde de manière chiffrée (AES-256-GCM) les identifiants bancaires d'un utilisateur.
 * Le mot de passe et le login ne sont JAMAIS stockés en clair.
 */
export async function saveBankCredentialsAction(
  input: SaveBankCredentialsInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // ID de démonstration si auth n'est pas encore activé en local
    const userId = user?.id || "00000000-0000-0000-0000-000000000000";

    if (!input.bankModule || !input.login || !input.password) {
      return { success: false, error: "Tous les champs obligatoires doivent être renseignés." };
    }

    // 1. Chiffrement AES-256-GCM du login
    const encLogin = encrypt(input.login);

    // 2. Chiffrement AES-256-GCM du mot de passe
    const encPass = encrypt(input.password);

    // 3. Insertion / Mise à jour dans la base
    const existing = await db
      .select()
      .from(bankCredentials)
      .where(
        and(
          eq(bankCredentials.userId, userId),
          eq(bankCredentials.bankModule, input.bankModule)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(bankCredentials)
        .set({
          label: input.label || input.bankModule.toUpperCase(),
          encryptedLogin: encLogin.encryptedData,
          ivLogin: encLogin.iv,
          tagLogin: encLogin.tag,
          encryptedPassword: encPass.encryptedData,
          ivPassword: encPass.iv,
          tagPassword: encPass.tag,
          updatedAt: new Date(),
        })
        .where(eq(bankCredentials.id, existing[0].id));
    } else {
      await db.insert(bankCredentials).values({
        userId: userId,
        bankModule: input.bankModule,
        label: input.label || input.bankModule.toUpperCase(),
        encryptedLogin: encLogin.encryptedData,
        ivLogin: encLogin.iv,
        tagLogin: encLogin.tag,
        encryptedPassword: encPass.encryptedData,
        ivPassword: encPass.iv,
        tagPassword: encPass.tag,
      });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Erreur lors du chiffrement et de l'enregistrement.",
    };
  }
}

/**
 * Récupère la liste des connecteurs configurés SANS JAMAIS renvoyer les mots de passe
 */
export async function getBankCredentialsStatusAction(): Promise<{
  success: boolean;
  credentials?: BankCredentialPublicInfo[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || "00000000-0000-0000-0000-000000000000";

    const rows = await db
      .select({
        id: bankCredentials.id,
        bankModule: bankCredentials.bankModule,
        label: bankCredentials.label,
        lastSyncedAt: bankCredentials.lastSyncedAt,
        createdAt: bankCredentials.createdAt,
      })
      .from(bankCredentials)
      .where(eq(bankCredentials.userId, userId));

    return {
      success: true,
      credentials: rows,
    };
  } catch (error: any) {
    return {
      success: false,
      credentials: [],
      error: error?.message || "Impossible de récupérer les statuts des banques.",
    };
  }
}

/**
 * Supprime un accès bancaire configuré
 */
export async function deleteBankCredentialsAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || "00000000-0000-0000-0000-000000000000";

    await db
      .delete(bankCredentials)
      .where(
        and(
          eq(bankCredentials.id, id),
          eq(bankCredentials.userId, userId)
        )
      );

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Erreur lors de la suppression du connecteur.",
    };
  }
}
