import { pgTable, uuid, numeric, date, timestamp } from "drizzle-orm/pg-core";

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  snapshotDate: date("snapshot_date").notNull(), // AAAA-MM-JJ
  totalValueEur: numeric("total_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  cashValueEur: numeric("cash_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  stockValueEur: numeric("stock_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  cryptoValueEur: numeric("crypto_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  realEstateValueEur: numeric("real_estate_value_eur", { precision: 18, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
