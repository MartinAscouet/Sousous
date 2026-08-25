import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const oauthTokens = pgTable("oauth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"), // Référence optionnelle à auth.users.id (permet les tokens globaux ou par utilisateur)
  provider: text("provider").notNull(), // 'saxo', 'bourso', etc.
  
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenType: text("token_type").notNull().default("Bearer"),
  
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  
  scope: text("scope"),
  baseUri: text("base_uri"),
  env: text("env").default("live"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type OAuthToken = typeof oauthTokens.$inferSelect;
export type NewOAuthToken = typeof oauthTokens.$inferInsert;
