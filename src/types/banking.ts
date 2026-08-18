import { AccountType } from "./financial";

export interface BankingAccount {
  id: string;
  label: string;
  balance: number;
  currency: string;
  type: AccountType;
  rawType?: string;
  iban?: string | null;
  bankName?: string;
}

export interface BankingApiResponse {
  success: boolean;
  accounts?: BankingAccount[];
  totalBalance?: number;
  currency?: string;
  fetchedAt?: string;
  error?: string;
  errorCode?: "AUTH_REQUIRED" | "2FA_REQUIRED" | "TIMEOUT" | "EXECUTION_ERROR" | "UNKNOWN";
  details?: string;
}
