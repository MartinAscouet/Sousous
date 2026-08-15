import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  symbol: text("symbol").notNull(), // Ticker Yahoo (CW8.PA) ou ID CoinGecko (bitcoin)
  name: text("name").notNull(),
  category: text("category").notNull(), // STOCK, ETF, CRYPTO, FIAT, REAL_ESTATE, etc.
  currentPrice: numeric("current_price", { precision: 18, scale: 8 }).notNull().default("0"),
  currency: text("currency").notNull().default("EUR"),
  lastPriceUpdate: timestamp("last_price_update", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
