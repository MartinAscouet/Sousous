import { pgTable, uuid, numeric, text, timestamp, index, date } from "drizzle-orm/pg-core";

/**
 * Table balance_snapshots
 * Stocke les relevés de soldes périodiques par enveloppe/compte pour le calcul de performance
 */
export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(), // 'total', 'saxo_pea', 'amundi_pee', 'crypto', 'banking', 'realestate'
    totalValue: numeric("total_value", { precision: 18, scale: 8 }).notNull().default("0"),
    cashBalance: numeric("cash_balance", { precision: 18, scale: 8 }),
    investedValue: numeric("invested_value", { precision: 18, scale: 8 }),
    snapshotDate: timestamp("snapshot_date", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountDateIdx: index("idx_balance_snapshots_account_date").on(table.accountId, table.snapshotDate),
  })
);

export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
export type NewBalanceSnapshot = typeof balanceSnapshots.$inferInsert;

/**
 * Table historique globale
 */
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  snapshotDate: date("snapshot_date").notNull(), // AAAA-MM-JJ
  totalValueEur: numeric("total_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  cashValueEur: numeric("cash_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  stockValueEur: numeric("stock_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  cryptoValueEur: numeric("crypto_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  realEstateValueEur: numeric("real_estate_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
