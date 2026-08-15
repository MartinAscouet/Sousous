import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(), // Référence à auth.users.id
  name: text("name").notNull(),
  type: text("type").notNull(), // CHECKING, SAVINGS, PEA, CTO, CRYPTO_EXCHANGE, etc.
  institutionName: text("institution_name"), // Boursorama, Fortuneo, Binance, etc.
  currency: text("currency").notNull().default("EUR"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
