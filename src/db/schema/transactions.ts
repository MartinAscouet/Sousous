import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { assets } from "./assets";

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  type: text("type").notNull(), // BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, FEE, TRANSFER
  quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 18, scale: 8 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 18, scale: 8 }).notNull().default("0"),
  fee: numeric("fee", { precision: 18, scale: 8 }).notNull().default("0"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
