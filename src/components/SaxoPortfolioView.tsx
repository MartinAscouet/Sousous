"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  RefreshCw,
  Wallet,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertCircle,
  Coins,
  ArrowUpRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { SaxoPeaSummary } from "@/lib/api/saxo/types";

interface SaxoApiResponse {
  success: boolean;
  pea?: SaxoPeaSummary;
  environment?: string;
  allAccounts?: Array<{
    accountKey: string;
    accountId: string;
    accountType: string;
    currency: string;
    displayName?: string;
  }>;
  fetchedAt?: string;
  error?: string;
}

interface SaxoPortfolioViewProps {
  hideHeader?: boolean;
}

export default function SaxoPortfolioView({ hideHeader = false }: SaxoPortfolioViewProps) {
  const [data, setData] = useState<SaxoPeaSummary | null>(null);
  const [environment, setEnvironment] = useState<string>("sim");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<string>("");

  const fetchSaxoData = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/investments/saxo", {
        cache: "no-store",
      });
      const json: SaxoApiResponse = await res.json().catch(() => ({}) as SaxoApiResponse);

      if (!res.ok || !json.success || !json.pea) {
        const errorDetail = json.error || (json as any).details || `Erreur serveur [HTTP ${res.status}]`;
        throw new Error(errorDetail);
      }

      setData(json.pea);
      setEnvironment(json.environment || "live");
      setLastSyncDate(new Date().toLocaleTimeString("fr-FR"));

      // Notifier le tableau de bord global
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sousous_saxo_updated", {
            detail: json.pea,
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
    // Vérifier si un message d'erreur est renvoyé par la route /callback dans l'URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("saxo_error");
      if (urlError) {
        setError(`Retour Saxo : ${decodeURIComponent(urlError)}`);
      }
    }

    fetchSaxoData();

    const handleGlobalRefresh = () => {
      fetchSaxoData(true);
    };

    window.addEventListener("sousous_refresh_all", handleGlobalRefresh);
    return () => {
      window.removeEventListener("sousous_refresh_all", handleGlobalRefresh);
    };
  }, [fetchSaxoData]);

  return (
    <div className="space-y-6">
      {/* En-tête de section optionnel */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
              Portefeuille PEA & Bourse (Saxo Bank)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Synchronisation directe en temps réel via la Saxo OpenAPI (OAuth 2.0)
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {environment === "sim" ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20" title="Environnement Sandbox Saxo avec solde de test par défaut">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Simulation (SIM)</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Saxo Live (Connecté)</span>
              </div>
            )}

            <button
              onClick={() => fetchSaxoData(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-400 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              {refreshing ? "Actualisation..." : "Synchroniser"}
            </button>
          </div>
        </div>
      )}

      {/* État de chargement : Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-800" />
                <div className="w-16 h-5 rounded-full bg-slate-800" />
              </div>
              <div className="space-y-2">
                <div className="w-32 h-4 rounded bg-slate-800" />
                <div className="w-44 h-7 rounded bg-slate-800" />
              </div>
              <div className="w-24 h-3 rounded bg-slate-800/60 pt-2" />
            </div>
          ))}
        </div>
      )}

      {/* État d'erreur */}
      {!loading && error && (
        <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-300">
                  Authentification Saxo requise ou expirée
                </h4>
                <p className="text-xs text-amber-200/80">{error}</p>
              </div>
            </div>

            <a
              href="/api/auth/saxo/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/30 transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              Se connecter à Saxo Bank
            </a>
          </div>
        </div>
      )}

      {/* Affichage des données réelles du compte PEA */}
      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 : Valeur Totale du PEA */}
            <div className="p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/20 hover:border-emerald-500/50 transition-all space-y-3 shadow-lg shadow-emerald-950/20">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  PEA Principal
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  Valeur Totale du PEA
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                  {formatCurrency(data.totalValue)}
                </div>
              </div>
              <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2.5 flex items-center justify-between">
                <span>Compte N° {data.accountId}</span>
                <span className="text-emerald-400 font-medium">{data.currency}</span>
              </div>
            </div>

            {/* Card 2 : Liquidités disponibles (Cash) */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-3 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                  Liquidités
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  Solde Espèces Disponible
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                  {formatCurrency(data.cashBalance)}
                </div>
              </div>
              <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-2.5">
                Prêt pour nouveaux achats d&apos;actions/ETF
              </div>
            </div>

            {/* Card 3 : Portefeuille Titres & Actions */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-3 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Building className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Portefeuille Actions
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  Valorisation Titres & ETF
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                  {formatCurrency(data.positionsValue)}
                </div>
              </div>
              <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-2.5">
                Actions, ETF éligibles PEA
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Dernière synchronisation Saxo OpenAPI : {lastSyncDate || "À l'instant"}</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Connecté en direct
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
