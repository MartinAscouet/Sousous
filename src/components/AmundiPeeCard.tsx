"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Briefcase,
  TrendingUp,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AmundiPeeSummary } from "@/lib/api/investments/amundi";

interface AmundiApiResponse {
  success: boolean;
  data?: AmundiPeeSummary;
  error?: string;
}

interface AmundiPeeCardProps {
  hideHeader?: boolean;
}

export default function AmundiPeeCard({ hideHeader = false }: AmundiPeeCardProps) {
  const [data, setData] = useState<AmundiPeeSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<string>("");

  const fetchAmundiData = useCallback(async (force = false) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const url = force ? "/api/investments/amundi?force=true" : "/api/investments/amundi";
      const res = await fetch(url, { cache: "no-store" });
      const json: AmundiApiResponse = await res.json();

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Impossible de récupérer la valorisation Amundi PEE");
      }

      setData(json.data);
      setLastSyncDate(new Date().toLocaleTimeString("fr-FR"));

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sousous_amundi_updated", {
            detail: json.data,
          })
        );
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAmundiData();

    const handleGlobalRefresh = () => {
      fetchAmundiData(true);
    };

    window.addEventListener("sousous_refresh_all", handleGlobalRefresh);
    return () => {
      window.removeEventListener("sousous_refresh_all", handleGlobalRefresh);
    };
  }, [fetchAmundiData]);

  return (
    <div className={hideHeader ? "space-y-4" : "p-6 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-indigo-950/20 backdrop-blur space-y-5 shadow-xl shadow-indigo-950/10"}>
      {/* En-tête de la carte optionnel */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Épargne Salariale PEE (Amundi)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Actionnariat Salarié
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Valorisation des parts Sopra Steria Group via Euronext Paris (SOP.PA)
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchAmundiData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center self-start sm:self-auto gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Actualisation..." : "Actualiser cours"}
          </button>
        </div>
      )}

      {/* État de chargement */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-800/40 space-y-2">
              <div className="w-20 h-3 rounded bg-slate-700" />
              <div className="w-32 h-6 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      )}

      {/* État d'erreur */}
      {!loading && error && (
        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Affichage des données réelles PEE */}
      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Colonne 1 : Valorisation Totale */}
            <div className="p-4 rounded-2xl border border-indigo-500/30 bg-slate-900/80 space-y-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Valorisation Totale PEE
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {formatCurrency(data.totalValue)}
              </div>
              <div className="text-[11px] text-indigo-300 font-medium">
                {data.quantity} actions Sopra Steria
              </div>
            </div>

            {/* Colonne 2 : Cours unitaire de l'action */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Cours Action (Euronext)
              </span>
              <div className="text-2xl font-bold text-white tracking-tight">
                {formatCurrency(data.unitPrice)}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>Ticker :</span>
                <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded font-mono font-bold">
                  {data.ticker}
                </code>
              </div>
            </div>

            {/* Colonne 3 : Détails de la ligne */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Gestionnaire de Tenue
              </span>
              <div className="text-base font-bold text-white">
                Amundi Épargne Salariale
              </div>
              <div className="text-[11px] text-slate-400">
                Plan d&apos;Épargne Entreprise (PEE)
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
            <span>Dernière cotation marché : {lastSyncDate || "À l'instant"}</span>
            <span className="inline-flex items-center gap-1 text-indigo-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Cours Euronext en direct
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
