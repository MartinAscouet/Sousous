import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un montant monétaire selon les standards français (Intl.NumberFormat)
 * @param amount Montant sous forme numérique ou string (NUMERIC DB)
 * @param currency Code de devise (EUR par défaut)
 * @param decimals Nombre de décimales à afficher (2 par défaut)
 */
export function formatCurrency(
  amount: number | string,
  currency: string = "EUR",
  decimals: number = 2
): string {
  const numericValue = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numericValue)) {
    return "0,00 €";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numericValue);
}

/**
 * Formate les quantités de crypto-monnaies ou d'actions (jusqu'à 8 décimales pour les crypto-fractions)
 */
export function formatAssetQuantity(quantity: number | string, isCrypto: boolean = false): string {
  const numericValue = typeof quantity === "string" ? parseFloat(quantity) : quantity;

  if (isNaN(numericValue)) return "0";

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: isCrypto ? 2 : 0,
    maximumFractionDigits: isCrypto ? 8 : 4,
  }).format(numericValue);
}
