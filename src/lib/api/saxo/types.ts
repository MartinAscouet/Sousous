/**
 * Types TypeScript pour la gestion de l'authentification OAuth 2.0 Saxo OpenAPI
 */

export type SaxoEnvironment = "live" | "sim";

export interface SaxoOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number; // en secondes
  expiresAt: number; // timestamp absolu en millisecondes
  refreshTokenExpiresIn?: number;
  refreshTokenExpiresAt?: number;
  scope?: string;
  baseUri?: string;
  env?: SaxoEnvironment;
}

export interface SaxoRawTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
  base_uri?: string;
  error?: string;
  error_description?: string;
}

export interface SaxoAuthConfig {
  appKey: string;
  appSecret: string;
  env?: SaxoEnvironment;
  authMethod?: "basic" | "body"; // Basic Auth Header ou paramètres dans le body
  safetyMarginSeconds?: number; // Marge de renouvellement anticipé (ex: 300s = 5min)
}

export interface ITokenStorage {
  loadTokens(): Promise<SaxoOAuthTokens | null>;
  saveTokens(tokens: SaxoOAuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface SaxoAccount {
  AccountKey: string;
  ClientKey: string;
  AccountId: string;
  AccountType: string;
  Currency: string;
  DisplayName?: string;
  Active: boolean;
}

export interface SaxoAccountsResponse {
  Data: SaxoAccount[];
}

export interface SaxoBalance {
  Currency: string;
  CashBalance: number;
  TotalValue: number;
  NonMarginPositionsValue: number;
  MarginAvailable?: number;
}

export interface SaxoPeaSummary {
  accountKey: string;
  clientKey: string;
  accountId: string;
  displayName: string;
  accountType: string;
  currency: string;
  cashBalance: number;
  positionsValue: number;
  totalValue: number;
  lastUpdated: string;
}
