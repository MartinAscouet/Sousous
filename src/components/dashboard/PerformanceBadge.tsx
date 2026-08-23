"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AccountPerformance } from "@/lib/api/performance/snapshot-service";

interface PerformanceBadgeProps {
  performance?: AccountPerformance;
  changeEur?: number;
  changePercentage?: number;
  hasHistory?: boolean;
  isMasked?: boolean;
  showAmount?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function PerformanceBadge({
  performance,
  changeEur: explicitEur,
  changePercentage: explicitPct,
  hasHistory: explicitHasHistory,
  isMasked = false,
  showAmount = true,
  size = "md",
}: PerformanceBadgeProps) {
  const diffEur = performance ? performance.changeEur : explicitEur ?? 0;
  const diffPct = performance ? performance.changePercentage : explicitPct ?? 0;
  const hasHistory = performance ? performance.hasHistory : explicitHasHistory ?? false;

  const isPositive = diffEur > 0;
  const isNegative = diffEur < 0;
  const isZero = diffEur === 0;

  // Formatage des pourcentages avec signe
  const formattedPct = `${isPositive ? "+" : ""}${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(diffPct)} %`;

  // Formatage du montant avec signe
  const formattedEur = isMasked
    ? "•••• €"
    : `${isPositive ? "+" : ""}${formatCurrency(diffEur)}`;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  }[size];

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  }[size];

  if (!hasHistory) {
    return (
      <div
        className={`inline-flex items-center rounded-full font-semibold border bg-slate-800/60 text-slate-400 border-slate-700/50 ${sizeClasses}`}
        title="Données d'historique en cours de constitution"
      >
        <Minus className={iconSizes} />
        <span>0,00 %</span>
      </div>
    );
  }

  if (isPositive) {
    return (
      <div
        className={`inline-flex items-center rounded-full font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm shadow-emerald-950/20 ${sizeClasses}`}
      >
        <TrendingUp className={iconSizes} />
        <span>{formattedPct}</span>
        {showAmount && (
          <span className="opacity-80 font-medium">({formattedEur})</span>
        )}
      </div>
    );
  }

  if (isNegative) {
    return (
      <div
        className={`inline-flex items-center rounded-full font-bold border bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-sm shadow-rose-950/20 ${sizeClasses}`}
      >
        <TrendingDown className={iconSizes} />
        <span>{formattedPct}</span>
        {showAmount && (
          <span className="opacity-80 font-medium">({formattedEur})</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center rounded-full font-semibold border bg-slate-800/60 text-slate-400 border-slate-700/50 ${sizeClasses}`}
    >
      <Minus className={iconSizes} />
      <span>0,00 %</span>
      {showAmount && <span className="opacity-70 font-medium">({formattedEur})</span>}
    </div>
  );
}
