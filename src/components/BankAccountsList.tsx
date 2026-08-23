"use client";

import React, { useState, useEffect } from "react";
import {
  Landmark,
  PiggyBank,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Wallet,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BankingAccount, BankingApiResponse } from "@/types/banking";
import BankCredentialsModal from "./BankCredentialsModal";

export default function BankAccountsList() {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [data, setData] = useState<BankingApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchAccounts = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/banking/accounts", {
        cache: "no-store",
      });
      const json: BankingApiResponse = await res.json();

      if (!res.ok || !json.success) {
        setData(json);
        setError(json.error || "Impossible de récupérer les comptes bancaires.");
      } else {
        setData(json);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("sousous_banking_updated", { detail: json })
          );
        }
      }
    } catch (err: any) {
      setError(err?.message || "Erreur de communication avec l'API.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAccounts();

    const handleGlobalRefresh = () => {
      fetchAccounts(true);
    };

    window.addEventListener("sousous_refresh_all", handleGlobalRefresh);
    return () => {
      window.removeEventListener("sousous_refresh_all", handleGlobalRefresh);
    };
  }, []);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "SAVINGS":
        return <PiggyBank className="w-5 h-5 text-teal-400" />;
      case "PEA":
      case "CTO":
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      default:
        return <Landmark className="w-5 h-5 text-blue-400" />;
    }
  };

  const getAccountBadge = (type: string) => {
    switch (type) {
      case "SAVINGS":
        return "bg-teal-500/10 text-teal-300 border-teal-500/20";
      case "PEA":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
      case "CTO":
        return "bg-purple-500/10 text-purple-300 border-purple-500/20";
      default:
        return "bg-blue-500/10 text-blue-300 border-blue-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-emerald-400" />
            Comptes Bancaires & Épargne (CMB)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Synchronisation directe en local via le connecteur Woob
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-slate-200 text-xs font-medium transition-all shadow-sm"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>Accès sécurisés</span>
          </button>

          <button
            onClick={() => fetchAccounts(true)}
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

      {/* État de chargement : Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* État d'erreur / Avertissement 2FA */}
      {!loading && error && (
        <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-200 space-y-3">
          <div className="flex items-start gap-3">
            {data?.errorCode === "2FA_REQUIRED" ? (
              <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            ) : data?.errorCode === "TIMEOUT" ? (
              <Clock className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-rose-300">
                {data?.errorCode === "2FA_REQUIRED"
                  ? "Authentification forte requise (2FA)"
                  : "Erreur lors de la synchronisation bancaire"}
              </h3>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                {error}
              </p>
              {data?.details && (
                <pre className="mt-2 p-2.5 rounded-lg bg-slate-950/80 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-28 border border-slate-800">
                  {data.details}
                </pre>
              )}
            </div>
          </div>
          {data?.errorCode === "2FA_REQUIRED" && (
            <p className="text-xs text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              💡 Veuillez ouvrir l'application mobile de votre banque pour valider la notification de connexion ou relancer <code>woob bank</code> dans un terminal interactif.
            </p>
          )}
        </div>
      )}

      {/* Liste des comptes */}
      {!loading && data?.success && data.accounts && (
        <div className="space-y-4">
          {/* Bannière Total Solde */}
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-300 font-medium">
                {data.accounts.length} comptes synchronisés
              </span>
              {data.fetchedAt && (
                <span className="text-[11px] text-slate-500">
                  • à {new Date(data.fetchedAt).toLocaleTimeString("fr-FR")}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-400">Total liquidités & livrets :</span>
              <span className="text-base font-bold text-emerald-400">
                {formatCurrency(data.totalBalance || 0, data.currency || "EUR")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700/80 transition-all space-y-4 backdrop-blur shadow-sm group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 group-hover:scale-105 transition-transform">
                    {getAccountIcon(acc.type)}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getAccountBadge(
                      acc.type
                    )}`}
                  >
                    {acc.type}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-300 truncate" title={acc.label}>
                    {acc.label}
                  </h4>
                  <div className="text-2xl font-bold text-white tracking-tight mt-1">
                    {formatCurrency(acc.balance, acc.currency)}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>ID: {acc.id}</span>
                  {acc.iban ? (
                    <span className="font-mono truncate max-w-[130px]" title={acc.iban}>
                      {acc.iban}
                    </span>
                  ) : (
                    <span>{acc.bankName || "CMB"}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modale de configuration sécurisée des accès bancaires */}
      <BankCredentialsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchAccounts(true);
        }}
      />
    </div>
  );
}
