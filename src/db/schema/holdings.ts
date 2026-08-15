import { pgTable, uuid, numeric, timestamp } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { assets } from "./assets";

export const holdings = pgTable("holdings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull().default("0"),
  averageBuyPrice: numeric("average_buy_price", { precision: 18, scale: 8 }).notNull().default("0"), // PRM (Prix de Revient Moyen)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
