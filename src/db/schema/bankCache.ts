import { pgTable, uuid, text, jsonb, numeric, timestamp } from "drizzle-orm/pg-core";

export const bankCache = pgTable("bank_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  bankModule: text("bank_module").notNull().default("cmb"),
  accountsData: jsonb("accounts_data").notNull(), // Stocke la liste complète des BankingAccount
  totalBalance: numeric("total_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  currency: text("currency").notNull().default("EUR"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BankCache = typeof bankCache.$inferSelect;
export type NewBankCache = typeof bankCache.$inferInsert;
