import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const bankCredentials = pgTable("bank_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(), // Référence à auth.users.id
  bankModule: text("bank_module").notNull(), // 'cmb', 'boursorama', 'fortuneo', etc.
  label: text("label"), // Nom optionnel affiché (ex: 'Mon Crédit Mutuel')
  
  // Identifiant chiffré
  encryptedLogin: text("encrypted_login").notNull(),
  ivLogin: text("iv_login").notNull(),
  tagLogin: text("tag_login").notNull(),
  
  // Mot de passe chiffré
  encryptedPassword: text("encrypted_password").notNull(),
  ivPassword: text("iv_password").notNull(),
  tagPassword: text("tag_password").notNull(),
  
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BankCredential = typeof bankCredentials.$inferSelect;
export type NewBankCredential = typeof bankCredentials.$inferInsert;
