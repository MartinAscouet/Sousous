"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  Briefcase,
  Coins,
  PiggyBank,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronsUpDown,
  PlusCircle,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  PieChart as PieChartIcon,
  Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import CollapsibleCard from "@/components/dashboard/CollapsibleCard";
import PerformanceBadge from "@/components/dashboard/PerformanceBadge";
import SaxoPortfolioView from "@/components/SaxoPortfolioView";
import AmundiPeeCard from "@/components/AmundiPeeCard";
import CryptoPortfolioView from "@/components/CryptoPortfolioView";
import BankAccountsList from "@/components/BankAccountsList";
import { BankingApiResponse, BankingAccount } from "@/types/banking";
import { OnChainAddressQuery, OnChainBalanceResult } from "@/lib/api/crypto/onchain";
import { SaxoPeaSummary } from "@/lib/api/saxo/types";
import { AmundiPeeSummary } from "@/lib/api/investments/amundi";
import { PerformancePeriod, PerformanceResponse } from "@/lib/api/performance/snapshot-service";

export default function DashboardPage() {
  // 1. États financiers réels
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [bankingAccountsCount, setBankingAccountsCount] = useState<number>(0);
  const [hasBankingData, setHasBankingData] = useState<boolean>(false);

  const [saxoTotal, setSaxoTotal] = useState<number>(0);
  const [saxoPea, setSaxoPea] = useState<SaxoPeaSummary | null>(null);

  const [amundiTotal, setAmundiTotal] = useState<number>(0);
  const [amundiData, setAmundiData] = useState<AmundiPeeSummary | null>(null);

  const [realEstateBalance] = useState<number>(0);

  const [meriaTotal, setMeriaTotal] = useState<number>(0);
  const [onChainTotal, setOnChainTotal] = useState<number>(0);
  const [cryptoPositionsCount, setCryptoPositionsCount] = useState<number>(0);
  const [onChainWalletsCount, setOnChainWalletsCount] = useState<number>(0);
  const [hasCryptoData, setHasCryptoData] = useState<boolean>(false);

  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 2. Options d'affichage & Période de performance
  const [selectedPeriod, setSelectedPeriod] = useState<PerformancePeriod>("1D");
  const [performanceData, setPerformanceData] = useState<PerformanceResponse | null>(null);
  const [isMasked, setIsMasked] = useState<boolean>(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    saxo: true,
    amundi: true,
    crypto: false,
    banking: false,
    realestate: false,
  });

  // Chargement des préférences mémorisées dans localStorage
  useEffect(() => {
    try {
      const savedMask = localStorage.getItem("sousous_masked_mode");
      if (savedMask !== null) {
        setIsMasked(savedMask === "true");
      }
      const savedPeriod = localStorage.getItem("sousous_perf_period");
      if (savedPeriod === "1D" || savedPeriod === "1W" || savedPeriod === "1M") {
        setSelectedPeriod(savedPeriod);
      }
      const savedSections = localStorage.getItem("sousous_dashboard_sections");
      if (savedSections) {
        setOpenSections(JSON.parse(savedSections));
      }
    } catch {}
  }, []);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("sousous_dashboard_sections", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleAllSections = () => {
    const allOpen = Object.values(openSections).every(Boolean);
    const newState = {
      saxo: !allOpen,
      amundi: !allOpen,
      crypto: !allOpen,
      banking: !allOpen,
      realestate: !allOpen,
    };
    setOpenSections(newState);
    try {
      localStorage.setItem("sousous_dashboard_sections", JSON.stringify(newState));
    } catch {}
  };

  const toggleMask = () => {
    setIsMasked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sousous_masked_mode", String(next));
      } catch {}
      return next;
    });
  };

  const handlePeriodChange = (period: PerformancePeriod) => {
    setSelectedPeriod(period);
    try {
      localStorage.setItem("sousous_perf_period", period);
    } catch {}
  };

  // 3. Récupération des données d'APIs
  const fetchBankingSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/banking/accounts", { cache: "no-store" });
      if (!res.ok) return;
      const json: BankingApiResponse = await res.json();
      if (json.success && Array.isArray(json.accounts)) {
        let cashSum = 0;
        let count = 0;

        json.accounts.forEach((acc: BankingAccount) => {
          if ((acc.type as string) !== "PEA" && (acc.type as string) !== "CTO") {
            cashSum += acc.balance || 0;
            count++;
          }
        });

        setCashBalance(cashSum);
        setBankingAccountsCount(count || json.accounts.length);
        setHasBankingData(true);
      }
    } catch {}
  }, []);

  const fetchAmundiSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/investments/amundi", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setAmundiData(json.data);
        setAmundiTotal(Number(json.data.totalValue || 0));
      }
    } catch {}
  }, []);

  const fetchCryptoSummary = useCallback(async () => {
    try {
      const resMeria = await fetch("/api/crypto/meria", { cache: "no-store" });
      if (resMeria.ok) {
        const jsonMeria = await resMeria.json();
        if (jsonMeria.success && jsonMeria.account) {
          setMeriaTotal(Number(jsonMeria.account.totalValueEur || 0));
          setCryptoPositionsCount(jsonMeria.account.activePositionsCount || (jsonMeria.account.positions || []).length);
          setHasCryptoData(true);
        }
      }

      let onChainAddrs: OnChainAddressQuery | null = null;
      try {
        const saved = localStorage.getItem("sousous_onchain_addresses");
        if (saved) onChainAddrs = JSON.parse(saved);
      } catch {}

      let resOnChain;
      if (onChainAddrs && (onChainAddrs.eth || onChainAddrs.btc || onChainAddrs.doge || onChainAddrs.xrp)) {
        resOnChain = await fetch("/api/crypto/onchain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(onChainAddrs),
          cache: "no-store",
        });
      } else {
        resOnChain = await fetch("/api/crypto/onchain", { cache: "no-store" });
      }

      if (resOnChain && resOnChain.ok) {
        const jsonOnChain = await resOnChain.json();
        if (jsonOnChain.success && Array.isArray(jsonOnChain.data)) {
          let ocTotal = 0;
          let ocCount = 0;
          jsonOnChain.data.forEach((item: OnChainBalanceResult) => {
            if (item.totalValueEur) ocTotal += item.totalValueEur;
            if (item.balance > 0) ocCount++;
          });
          setOnChainTotal(ocTotal);
          setOnChainWalletsCount(ocCount || jsonOnChain.data.length);
          setHasCryptoData(true);
        }
      }
    } catch {}
  }, []);

  // Calcul des totaux actuels
  const calculatedStocks = saxoTotal + amundiTotal;
  const calculatedCrypto = meriaTotal + onChainTotal;
  const calculatedCash = cashBalance;
  const calculatedRealEstate = realEstateBalance;
  const totalNetWorth = calculatedStocks + calculatedCrypto + calculatedCash + calculatedRealEstate;

  // Récupération de la performance pour la période sélectionnée
  const fetchPerformance = useCallback(async (period: PerformancePeriod) => {
    try {
      const params = new URLSearchParams({
        period,
        total: String(totalNetWorth),
        saxo: String(saxoTotal),
        amundi: String(amundiTotal),
        crypto: String(calculatedCrypto),
        banking: String(calculatedCash),
        realestate: String(calculatedRealEstate),
      });

      const res = await fetch(`/api/performance?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.performance) {
        setPerformanceData(json.performance);
      }
    } catch {}
  }, [totalNetWorth, saxoTotal, amundiTotal, calculatedCrypto, calculatedCash, calculatedRealEstate]);

  useEffect(() => {
    fetchBankingSummary();
    fetchAmundiSummary();
    fetchCryptoSummary();
    setLastSyncTime(new Date().toLocaleTimeString("fr-FR"));

    const handleBankingUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<BankingApiResponse>;
      const data = customEvent.detail;
      if (data && Array.isArray(data.accounts)) {
        let cashSum = 0;
        let count = 0;
        data.accounts.forEach((acc) => {
          if ((acc.type as string) !== "PEA" && (acc.type as string) !== "CTO") {
            cashSum += acc.balance || 0;
            count++;
          }
        });
        setCashBalance(cashSum);
        setBankingAccountsCount(count || data.accounts.length);
        setHasBankingData(true);
      }
    };

    const handleSaxoUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<SaxoPeaSummary>;
      const pea = customEvent.detail;
      if (pea) {
        setSaxoPea(pea);
        setSaxoTotal(Number(pea.totalValue || 0));
      }
    };

    const handleAmundiUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<AmundiPeeSummary>;
      const amundi = customEvent.detail;
      if (amundi) {
        setAmundiData(amundi);
        setAmundiTotal(Number(amundi.totalValue || 0));
      }
    };

    const handleCryptoUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const detail = customEvent.detail;
      if (detail?.type === "meria" && detail.account) {
        setMeriaTotal(Number(detail.account.totalValueEur || 0));
        setCryptoPositionsCount(detail.account.activePositionsCount || (detail.account.positions || []).length);
        setHasCryptoData(true);
      } else if (detail?.type === "onchain" && Array.isArray(detail.balances)) {
        let ocTotal = 0;
        let ocCount = 0;
        detail.balances.forEach((item: OnChainBalanceResult) => {
          if (item.totalValueEur) ocTotal += item.totalValueEur;
          if (item.balance > 0) ocCount++;
        });
        setOnChainTotal(ocTotal);
        setOnChainWalletsCount(ocCount || detail.balances.length);
        setHasCryptoData(true);
      }
    };

    window.addEventListener("sousous_banking_updated", handleBankingUpdate);
    window.addEventListener("sousous_saxo_updated", handleSaxoUpdate);
    window.addEventListener("sousous_amundi_updated", handleAmundiUpdate);
    window.addEventListener("sousous_crypto_updated", handleCryptoUpdate);

    return () => {
      window.removeEventListener("sousous_banking_updated", handleBankingUpdate);
      window.removeEventListener("sousous_saxo_updated", handleSaxoUpdate);
      window.removeEventListener("sousous_amundi_updated", handleAmundiUpdate);
      window.removeEventListener("sousous_crypto_updated", handleCryptoUpdate);
    };
  }, [fetchBankingSummary, fetchAmundiSummary, fetchCryptoSummary]);

  // Re-calculer les performances quand les montants ou la période changent
  useEffect(() => {
    fetchPerformance(selectedPeriod);
  }, [selectedPeriod, fetchPerformance]);

  // Actualisation globale manuelle & capture d'un snapshot
  const handleGlobalRefresh = async () => {
    setIsRefreshing(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("sousous_refresh_all"));
    }
    await Promise.all([fetchBankingSummary(), fetchAmundiSummary(), fetchCryptoSummary()]);
    // Enregistrement d'un snapshot à la demande
    fetch("/api/cron/snapshot", { method: "POST" }).catch(() => {});
    setLastSyncTime(new Date().toLocaleTimeString("fr-FR"));
    setTimeout(() => {
      fetchPerformance(selectedPeriod);
      setIsRefreshing(false);
    }, 600);
  };

  const stocksPct = totalNetWorth > 0 ? ((calculatedStocks / totalNetWorth) * 100).toFixed(1) : "0.0";
  const saxoPct = totalNetWorth > 0 ? ((saxoTotal / totalNetWorth) * 100).toFixed(1) : "0.0";
  const amundiPct = totalNetWorth > 0 ? ((amundiTotal / totalNetWorth) * 100).toFixed(1) : "0.0";
  const cryptoPct = totalNetWorth > 0 ? ((calculatedCrypto / totalNetWorth) * 100).toFixed(1) : "0.0";
  const cashPct = totalNetWorth > 0 ? ((calculatedCash / totalNetWorth) * 100).toFixed(1) : "0.0";
  const realEstatePct = totalNetWorth > 0 ? ((calculatedRealEstate / totalNetWorth) * 100).toFixed(1) : "0.0";

  const allOpen = Object.values(openSections).every(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      {/* 🔝 1. BARRE DE NAVIGATION & CONTRÔLES HAUT DE PAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-emerald-400" />
            Tableau de Bord
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Synthèse multi-actifs, historique et calcul de performance
          </p>
        </div>

        {/* Boutons d'actions rapides (Discrétion, Déplier tout, Actualiser) */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Bouton Mode Discrétion */}
          <button
            onClick={toggleMask}
            title={isMasked ? "Afficher les montants" : "Masquer les montants"}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5"
          >
            {isMasked ? (
              <>
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Afficher</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Masquer</span>
              </>
            )}
          </button>

          {/* Bouton Tout Déplier / Tout Replier */}
          <button
            onClick={toggleAllSections}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <ChevronsUpDown className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">{allOpen ? "Tout replier" : "Tout déplier"}</span>
          </button>

          {/* Bouton Actualiser */}
          <button
            onClick={handleGlobalRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-200 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Actualisation..." : "Actualiser"}</span>
          </button>

          <Link
            href="/dashboard/assets/add"
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Ajouter</span>
          </Link>
        </div>
      </div>

      {/* 🌟 2. SYNTHÈSE GLOBALE & PATRIMOINE TOTAL (ALWAYS VISIBLE) */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 p-6 sm:p-8 md:p-10 shadow-2xl shadow-emerald-950/20">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="inline-flex items-center self-start gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              Patrimoine Net Consolidé
            </span>

            {/* Sélecteur de période temporelle 1J / 1S / 1M */}
            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-800">
                {(["1D", "1W", "1M"] as PerformancePeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => handlePeriodChange(period)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedPeriod === period
                        ? "bg-emerald-500 text-slate-950 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {period === "1D" ? "1J" : period === "1W" ? "1S" : "1M"}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pl-2">
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> En direct
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {lastSyncTime || "À l'instant"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight font-mono sm:font-sans">
                  {isMasked ? "•••••••• €" : formatCurrency(totalNetWorth)}
                </div>

                {/* Badge de variation temporelle globale */}
                <PerformanceBadge
                  performance={performanceData?.total}
                  isMasked={isMasked}
                  size="lg"
                />
              </div>

              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Variation sur la période sélectionnée ({selectedPeriod === "1D" ? "24 heures" : selectedPeriod === "1W" ? "7 jours" : "1 mois"})
              </p>
            </div>
          </div>

          {/* Barre de répartition visuelle micro-animée */}
          <div className="space-y-2 pt-2">
            <div className="h-3 w-full rounded-full bg-slate-950 p-0.5 flex overflow-hidden border border-slate-800">
              <div
                style={{ width: `${stocksPct}%` }}
                className="h-full bg-emerald-400 rounded-l-full transition-all duration-500"
                title={`PEA & PEE: ${stocksPct}% (${formatCurrency(calculatedStocks)})`}
              />
              <div
                style={{ width: `${cryptoPct}%` }}
                className="h-full bg-amber-400 transition-all duration-500"
                title={`Crypto: ${cryptoPct}% (${formatCurrency(calculatedCrypto)})`}
              />
              <div
                style={{ width: `${cashPct}%` }}
                className="h-full bg-teal-400 transition-all duration-500"
                title={`Banque & Épargne: ${cashPct}% (${formatCurrency(calculatedCash)})`}
              />
              <div
                style={{ width: `${realEstatePct}%` }}
                className="h-full bg-cyan-400 rounded-r-full transition-all duration-500"
                title={`Immobilier: ${realEstatePct}% (${formatCurrency(calculatedRealEstate)})`}
              />
            </div>

            {/* Micro-pills des 4 catégories */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-slate-400 truncate">Bourse & PEE :</span>
                <span className="font-semibold text-white ml-auto">
                  {stocksPct}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-slate-400 truncate">Crypto :</span>
                <span className="font-semibold text-white ml-auto">
                  {cryptoPct}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400 shrink-0" />
                <span className="text-slate-400 truncate">Épargne :</span>
                <span className="font-semibold text-white ml-auto">
                  {cashPct}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                <span className="text-slate-400 truncate">Immobilier :</span>
                <span className="font-semibold text-white ml-auto">
                  {realEstatePct}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📂 3. SECTIONS DÉPLIANTES PAR COMPTE & ENVELOPPE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-emerald-400" />
            Comptes & Enveloppes Financières
          </h2>
          <span className="text-xs text-slate-500">
            Performance calculée sur : <strong className="text-emerald-400">{selectedPeriod === "1D" ? "1 Jour" : selectedPeriod === "1W" ? "1 Semaine" : "1 Mois"}</strong>
          </span>
        </div>

        {/* --- SECTION 1 : PEA SAXO BANK --- */}
        <CollapsibleCard
          id="saxo"
          isOpen={!!openSections.saxo}
          onToggle={() => toggleSection("saxo")}
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          iconBgColor="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          title="Plan d'Épargne en Actions (PEA)"
          subtitle={
            saxoPea
              ? `Saxo Bank • Compte N° ${saxoPea.accountId}`
              : "Saxo Bank • Actions & ETF"
          }
          badge={
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Saxo Live
            </span>
          }
          totalAmount={saxoTotal}
          percentage={saxoPct}
          performanceBadge={
            <PerformanceBadge
              performance={performanceData?.accounts?.["saxo_pea"]}
              isMasked={isMasked}
              size="sm"
            />
          }
          isMasked={isMasked}
          formatCurrency={formatCurrency}
          accentBorderColor="hover:border-emerald-500/40"
        >
          <SaxoPortfolioView hideHeader={true} />
        </CollapsibleCard>

        {/* --- SECTION 2 : PEE AMUNDI --- */}
        <CollapsibleCard
          id="amundi"
          isOpen={!!openSections.amundi}
          onToggle={() => toggleSection("amundi")}
          icon={<Briefcase className="w-5 h-5 text-indigo-400" />}
          iconBgColor="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
          title="Épargne Salariale (PEE)"
          subtitle={
            amundiData
              ? `Amundi • ${amundiData.quantity} actions Sopra Steria (${amundiData.ticker})`
              : "Amundi • Sopra Steria Group"
          }
          badge={
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Euronext Paris
            </span>
          }
          totalAmount={amundiTotal}
          percentage={amundiPct}
          performanceBadge={
            <PerformanceBadge
              performance={performanceData?.accounts?.["amundi_pee"]}
              isMasked={isMasked}
              size="sm"
            />
          }
          isMasked={isMasked}
          formatCurrency={formatCurrency}
          accentBorderColor="hover:border-indigo-500/40"
        >
          <AmundiPeeCard hideHeader={true} />
        </CollapsibleCard>

        {/* --- SECTION 3 : CRYPTO-MONNAIES --- */}
        <CollapsibleCard
          id="crypto"
          isOpen={!!openSections.crypto}
          onToggle={() => toggleSection("crypto")}
          icon={<Coins className="w-5 h-5 text-amber-400" />}
          iconBgColor="bg-amber-500/10 border-amber-500/20 text-amber-400"
          title="Portefeuille Crypto-monnaies"
          subtitle={
            cryptoPositionsCount > 0
              ? `${cryptoPositionsCount} positions Meria ${
                  onChainWalletsCount > 0 ? `• ${onChainWalletsCount} wallets on-chain` : ""
                }`
              : "Meria & Wallets On-Chain (BTC, ETH, DOGE, XRP)"
          }
          badge={
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Meria + On-Chain
            </span>
          }
          totalAmount={calculatedCrypto}
          percentage={cryptoPct}
          performanceBadge={
            <PerformanceBadge
              performance={performanceData?.accounts?.["crypto"]}
              isMasked={isMasked}
              size="sm"
            />
          }
          isMasked={isMasked}
          formatCurrency={formatCurrency}
          accentBorderColor="hover:border-amber-500/40"
        >
          <CryptoPortfolioView />
        </CollapsibleCard>

        {/* --- SECTION 4 : COMPTES BANCAIRES & ÉPARGNE --- */}
        <CollapsibleCard
          id="banking"
          isOpen={!!openSections.banking}
          onToggle={() => toggleSection("banking")}
          icon={<PiggyBank className="w-5 h-5 text-teal-400" />}
          iconBgColor="bg-teal-500/10 border-teal-500/20 text-teal-400"
          title="Comptes Bancaires & Livrets"
          subtitle={
            hasBankingData && bankingAccountsCount > 0
              ? `${bankingAccountsCount} comptes connectés (Crédit Mutuel de Bretagne)`
              : "Comptes courants & livrets réglementés"
          }
          badge={
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
              CMB Direct
            </span>
          }
          totalAmount={calculatedCash}
          percentage={cashPct}
          performanceBadge={
            <PerformanceBadge
              performance={performanceData?.accounts?.["banking"]}
              isMasked={isMasked}
              size="sm"
            />
          }
          isMasked={isMasked}
          formatCurrency={formatCurrency}
          accentBorderColor="hover:border-teal-500/40"
        >
          <BankAccountsList />
        </CollapsibleCard>

        {/* --- SECTION 5 : IMMOBILIER & SCPI --- */}
        <CollapsibleCard
          id="realestate"
          isOpen={!!openSections.realestate}
          onToggle={() => toggleSection("realestate")}
          icon={<Building2 className="w-5 h-5 text-cyan-400" />}
          iconBgColor="bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
          title="Immobilier & SCPI"
          subtitle="Résidence principale, locatif & parts de SCPI"
          badge={
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
              0 € (Optionnel)
            </span>
          }
          totalAmount={calculatedRealEstate}
          percentage={realEstatePct}
          isMasked={isMasked}
          formatCurrency={formatCurrency}
          accentBorderColor="hover:border-cyan-500/40"
        >
          <div className="p-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">
                Aucun bien immobilier ou SCPI renseigné
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Vous pouvez ajouter votre résidence principale ou vos investissements locatifs pour les intégrer à votre valeur nette.
              </p>
            </div>
            <Link
              href="/dashboard/assets/add"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white transition-all shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5 text-cyan-400" /> Ajouter un bien
            </Link>
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
}
