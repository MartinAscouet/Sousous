import { db } from "@/db";
import { balanceSnapshots } from "@/db/schema/snapshots";
import { desc, and, lte, eq } from "drizzle-orm";
import { SaxoClient } from "@/lib/api/saxo/client";
import { getAmundiPeeSummary } from "@/lib/api/investments/amundi";
import { MeriaClient } from "@/lib/api/crypto/meria";
import { fetchAllOnChainBalances, OnChainBalanceResult } from "@/lib/api/crypto/onchain";

export type PerformancePeriod = "1D" | "1W" | "1M";

export interface AccountPerformance {
  accountId: string;
  currentValue: number;
  referenceValue: number;
  changeEur: number;
  changePercentage: number;
  referenceDate: string | null;
  hasHistory: boolean;
}

export interface PerformanceResponse {
  period: PerformancePeriod;
  targetDate: string;
  accounts: Record<string, AccountPerformance>;
  total: AccountPerformance;
}

/**
 * Capture et enregistre les soldes actuels de tous les comptes dans `balance_snapshots`
 */
export async function recordAllSnapshots(): Promise<{
  success: boolean;
  insertedCount: number;
  snapshots: Array<{ accountId: string; totalValue: number }>;
}> {
  const now = new Date();

  // 1. Saxo PEA
  let saxoTotal = 0;
  let saxoCash = 0;
  let saxoInvested = 0;
  try {
    const saxoClient = new SaxoClient();
    const pea = await saxoClient.getPeaSummary();
    saxoTotal = pea.totalValue || 0;
    saxoCash = pea.cashBalance || 0;
    saxoInvested = pea.positionsValue || 0;
  } catch (err) {
    console.warn("[Snapshot] Erreur récupération Saxo PEA :", err);
  }

  // 2. Amundi PEE (Sopra Steria)
  let amundiTotal = 0;
  try {
    const amundi = await getAmundiPeeSummary();
    amundiTotal = amundi.totalValue || 0;
  } catch (err) {
    console.warn("[Snapshot] Erreur récupération Amundi PEE :", err);
  }

  // 3. Crypto (Meria + On-Chain)
  let cryptoTotal = 0;
  try {
    let meriaVal = 0;
    if (process.env.MERIA_API_KEY) {
      const meriaClient = new MeriaClient();
      const meriaSummary = await meriaClient.getAccountSummary().catch(() => null);
      meriaVal = meriaSummary?.totalValueEur || 0;
    }

    const onChainQuery = {
      eth: process.env.ETH_ADDRESS,
      btc: process.env.BTC_ADDRESS,
      doge: process.env.DOGE_ADDRESS,
      xrp: process.env.XRP_ADDRESS,
    };
    const onChain: OnChainBalanceResult[] = await fetchAllOnChainBalances(onChainQuery).catch(() => []);
    const onChainVal = onChain.reduce((acc: number, item: OnChainBalanceResult) => acc + (item.totalValueEur || 0), 0);

    cryptoTotal = Number((meriaVal + onChainVal).toFixed(2));
  } catch (err) {
    console.warn("[Snapshot] Erreur récupération Crypto :", err);
  }

  // 4. Comptes Bancaires / Épargne (Estimation ou appel local)
  let bankingTotal = 0;
  try {
    // Si des comptes sont déjà enregistrés en base, on peut récupérer le dernier solde
    const lastBanking = await db
      .select()
      .from(balanceSnapshots)
      .where(eq(balanceSnapshots.accountId, "banking"))
      .orderBy(desc(balanceSnapshots.snapshotDate))
      .limit(1);

    if (lastBanking.length > 0) {
      bankingTotal = Number(lastBanking[0].totalValue || 0);
    }
  } catch {}

  const realEstateTotal = 0;
  const totalNetWorth = Number(
    (saxoTotal + amundiTotal + cryptoTotal + bankingTotal + realEstateTotal).toFixed(2)
  );

  const snapshotsToInsert = [
    {
      accountId: "total",
      totalValue: totalNetWorth.toString(),
      cashBalance: (saxoCash + bankingTotal).toString(),
      investedValue: (saxoInvested + amundiTotal + cryptoTotal).toString(),
      snapshotDate: now,
    },
    {
      accountId: "saxo_pea",
      totalValue: saxoTotal.toString(),
      cashBalance: saxoCash.toString(),
      investedValue: saxoInvested.toString(),
      snapshotDate: now,
    },
    {
      accountId: "amundi_pee",
      totalValue: amundiTotal.toString(),
      investedValue: amundiTotal.toString(),
      snapshotDate: now,
    },
    {
      accountId: "crypto",
      totalValue: cryptoTotal.toString(),
      investedValue: cryptoTotal.toString(),
      snapshotDate: now,
    },
    {
      accountId: "banking",
      totalValue: bankingTotal.toString(),
      cashBalance: bankingTotal.toString(),
      snapshotDate: now,
    },
    {
      accountId: "realestate",
      totalValue: realEstateTotal.toString(),
      snapshotDate: now,
    },
  ];

  try {
    await db.insert(balanceSnapshots).values(snapshotsToInsert);
    console.log(`[Snapshot] ✅ ${snapshotsToInsert.length} snapshots enregistrés avec succès à ${now.toISOString()}`);

    return {
      success: true,
      insertedCount: snapshotsToInsert.length,
      snapshots: snapshotsToInsert.map((s) => ({
        accountId: s.accountId,
        totalValue: Number(s.totalValue),
      })),
    };
  } catch (error) {
    console.error("[Snapshot] ❌ Erreur lors de l'insertion des snapshots en base :", error);
    throw error;
  }
}

/**
 * Calcule la date de référence en fonction de la période choisie
 */
function getReferenceDateForPeriod(period: PerformancePeriod): Date {
  const now = new Date();
  switch (period) {
    case "1D": {
      // Il y a 24 heures
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    case "1W": {
      // Il y a 7 jours
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    case "1M": {
      // 1 mois en arrière (30 jours)
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

/**
 * Calcule les métriques de variation (Δ€ et Δ%) pour une enveloppe donnée
 */
export async function calculateAccountPerformance(
  accountId: string,
  currentValue: number,
  targetDate: Date
): Promise<AccountPerformance> {
  try {
    // Recherche du snapshot le plus proche à la date cible ou avant
    const snapshots = await db
      .select()
      .from(balanceSnapshots)
      .where(
        and(
          eq(balanceSnapshots.accountId, accountId),
          lte(balanceSnapshots.snapshotDate, targetDate)
        )
      )
      .orderBy(desc(balanceSnapshots.snapshotDate))
      .limit(1);

    if (snapshots.length === 0) {
      // Si aucun snapshot ancien n'existe, tenter de prendre le plus ancien disponible
      const oldest = await db
        .select()
        .from(balanceSnapshots)
        .where(eq(balanceSnapshots.accountId, accountId))
        .orderBy(balanceSnapshots.snapshotDate)
        .limit(1);

      if (oldest.length === 0 || Number(oldest[0].totalValue) === currentValue) {
        return {
          accountId,
          currentValue,
          referenceValue: currentValue,
          changeEur: 0,
          changePercentage: 0,
          referenceDate: null,
          hasHistory: false,
        };
      }

      const refVal = Number(oldest[0].totalValue);
      const diffEur = Number((currentValue - refVal).toFixed(2));
      const diffPct = refVal > 0 ? Number(((diffEur / refVal) * 100).toFixed(2)) : 0;

      return {
        accountId,
        currentValue,
        referenceValue: refVal,
        changeEur: diffEur,
        changePercentage: diffPct,
        referenceDate: oldest[0].snapshotDate.toISOString(),
        hasHistory: true,
      };
    }

    const ref = snapshots[0];
    const refVal = Number(ref.totalValue);
    const diffEur = Number((currentValue - refVal).toFixed(2));
    const diffPct = refVal > 0 ? Number(((diffEur / refVal) * 100).toFixed(2)) : 0;

    return {
      accountId,
      currentValue,
      referenceValue: refVal,
      changeEur: diffEur,
      changePercentage: diffPct,
      referenceDate: ref.snapshotDate.toISOString(),
      hasHistory: true,
    };
  } catch (err) {
    console.warn(`[Performance] Erreur de calcul pour ${accountId}:`, err);
    return {
      accountId,
      currentValue,
      referenceValue: currentValue,
      changeEur: 0,
      changePercentage: 0,
      referenceDate: null,
      hasHistory: false,
    };
  }
}

/**
 * Récupère l'ensemble des variations de performance pour la période demandée
 */
export async function getPerformanceSummary(
  period: PerformancePeriod,
  currentBalances: {
    total: number;
    saxo_pea?: number;
    amundi_pee?: number;
    crypto?: number;
    banking?: number;
    realestate?: number;
  }
): Promise<PerformanceResponse> {
  const targetDate = getReferenceDateForPeriod(period);

  const accountKeys = ["total", "saxo_pea", "amundi_pee", "crypto", "banking", "realestate"];
  const accounts: Record<string, AccountPerformance> = {};

  await Promise.all(
    accountKeys.map(async (key) => {
      const currentVal =
        key === "total"
          ? currentBalances.total
          : currentBalances[key as keyof typeof currentBalances] || 0;

      accounts[key] = await calculateAccountPerformance(key, currentVal, targetDate);
    })
  );

  return {
    period,
    targetDate: targetDate.toISOString(),
    accounts,
    total: accounts["total"],
  };
}
