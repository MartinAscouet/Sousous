"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Coins,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Percent,
  Wallet,
  AlertCircle,
  Key,
  Layers,
  ArrowUpRight,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { CryptoPosition, CryptoAccountSummary } from "@/lib/api/crypto/types";
import { OnChainBalanceResult, OnChainAddressQuery } from "@/lib/api/crypto/onchain";
import { formatCurrency } from "@/lib/utils";

interface Highlights {
  activePositionsCount: number;
  totalEstimatedValueEur?: number;
  assetsWithStaking: number;
  assetsWithLending: number;
  assetsWithSpot: number;
}

export default function CryptoPortfolioView() {
  const [account, setAccount] = useState<CryptoAccountSummary | null>(null);
  const [highlights, setHighlights] = useState<Highlights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState<string>("");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"meria" | "onchain">("meria");

  // State On-Chain Wallets
  const [onChainAddresses, setOnChainAddresses] = useState<OnChainAddressQuery>({
    eth: "",
    btc: "",
    doge: "",
    xrp: "",
  });
  const [onChainBalances, setOnChainBalances] = useState<OnChainBalanceResult[]>([]);
  const [onChainLoading, setOnChainLoading] = useState<boolean>(false);
  const [onChainSyncDate, setOnChainSyncDate] = useState<string>("");
  const [isOnChainModalOpen, setIsOnChainModalOpen] = useState<boolean>(false);

  const fetchMeriaData = useCallback(async (keyOverride?: string) => {
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      const keyToUse = keyOverride || customKey;
      if (keyToUse) {
        headers["x-meria-api-key"] = keyToUse;
      }

      const res = await fetch("/api/crypto/meria", {
        headers,
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "MISSING_API_KEY") {
          setIsKeyModalOpen(true);
        }
        throw new Error(data.error || "Impossible de récupérer les données Meria");
      }

      setAccount(data.account);
      setHighlights(data.highlights);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sousous_crypto_updated", {
            detail: { type: "meria", account: data.account, highlights: data.highlights },
          })
        );
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [customKey]);

  const fetchOnChainData = useCallback(async (addressesParam?: OnChainAddressQuery) => {
    // Si des adresses sont passées en paramètre, les utiliser prioritairement
    let addrs = addressesParam;
    if (!addrs) {
      try {
        const saved = localStorage.getItem("sousous_onchain_addresses");
        if (saved) {
          addrs = JSON.parse(saved);
        }
      } catch {
        // ignore
      }
    }

    if (!addrs || (!addrs.eth && !addrs.btc && !addrs.doge && !addrs.xrp)) {
      return;
    }

    setOnChainLoading(true);
    try {
      const res = await fetch("/api/crypto/onchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addrs),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setOnChainBalances(data.data);
        setOnChainSyncDate(data.syncDate || new Date().toLocaleString("fr-FR"));

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("sousous_crypto_updated", {
              detail: { type: "onchain", balances: data.data },
            })
          );
        }
      }
    } catch {} finally {
      setOnChainLoading(false);
    }
  }, []);

  // Chargement initial Meria au montage & listener refresh
  useEffect(() => {
    fetchMeriaData();

    const handleGlobalRefresh = () => {
      fetchMeriaData();
      fetchOnChainData();
    };

    window.addEventListener("sousous_refresh_all", handleGlobalRefresh);
    return () => {
      window.removeEventListener("sousous_refresh_all", handleGlobalRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialisation et restauration automatique des adresses On-Chain au montage (une seule fois)
  useEffect(() => {
    let loadedFromStorage = false;
    try {
      const saved = localStorage.getItem("sousous_onchain_addresses");
      if (saved) {
        const parsed: OnChainAddressQuery = JSON.parse(saved);
        if (parsed.eth || parsed.btc || parsed.doge || parsed.xrp) {
          setOnChainAddresses(parsed);
          fetchOnChainData(parsed);
          loadedFromStorage = true;
        }
      }
    } catch (err) {
      console.warn("Impossible de lire localStorage :", err);
    }

    if (!loadedFromStorage) {
      // Fallback : Vérifier si des adresses sont configurées côté serveur (.env.local)
      fetch("/api/crypto/onchain", { cache: "no-store" })
        .then((r) => r.json())
        .then((res) => {
          if (res.savedAddresses && (res.savedAddresses.eth || res.savedAddresses.btc || res.savedAddresses.doge || res.savedAddresses.xrp)) {
            setOnChainAddresses(res.savedAddresses);
            if (res.data && res.data.length > 0) {
              setOnChainBalances(res.data);
              setOnChainSyncDate(res.syncDate || new Date().toLocaleString("fr-FR"));
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("sousous_crypto_updated", {
                    detail: { type: "onchain", balances: res.data },
                  })
                );
              }
            }
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSaveCustomKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customKey.trim()) return;
    setIsKeyModalOpen(false);
    fetchMeriaData(customKey.trim());
  };

  const handleSaveOnChainAddresses = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("sousous_onchain_addresses", JSON.stringify(onChainAddresses));
    } catch (err) {
      console.warn("Impossible d'écrire dans localStorage :", err);
    }
    setIsOnChainModalOpen(false);
    fetchOnChainData(onChainAddresses);
  };


  return (
    <div className="space-y-6">
      {/* Header & Tabs Multi-Comptes / On-Chain */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Portefeuille Crypto Multi-Comptes & On-Chain
            </h2>
            <p className="text-xs text-slate-400">
              Suivi unifié de vos actifs Meria, Staking, Lending & Wallets Blockchains publics
            </p>
          </div>
        </div>

        {/* Sélecteur d'onglets */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab("meria")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === "meria"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Compte Meria
            </button>
            <button
              onClick={() => setActiveTab("onchain")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === "onchain"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Wallets On-Chain
            </button>
          </div>

          {activeTab === "meria" ? (
            <>
              <button
                onClick={() => setIsKeyModalOpen(true)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
                title="Configurer la clé API Meria"
              >
                <Key className="w-4 h-4 text-amber-400" />
              </button>
              <button
                onClick={() => fetchMeriaData()}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : "text-slate-400"}`} />
                Actualiser
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsOnChainModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-medium border border-cyan-500/30 transition-all flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" /> Adresses
              </button>
              <button
                onClick={() => fetchOnChainData()}
                disabled={onChainLoading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${onChainLoading ? "animate-spin text-cyan-400" : "text-slate-400"}`} />
                Actualiser
              </button>
            </>
          )}
        </div>
      </div>

      {/* ONGLET 1 : MERIA PORTFOLIO */}
      {activeTab === "meria" && (
        <>
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Erreur de récupération Meria</p>
                <p className="text-xs text-rose-300/90 mt-0.5">{error}</p>
                <button
                  onClick={() => setIsKeyModalOpen(true)}
                  className="mt-2 text-xs text-amber-400 underline hover:text-amber-300 font-medium"
                >
                  Configurer ou corriger votre clé API Meria
                </button>
              </div>
            </div>
          )}

          {highlights && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Valorisation Meria</span>
                  <Coins className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {highlights.totalEstimatedValueEur
                    ? formatCurrency(highlights.totalEstimatedValueEur)
                    : "—"}
                </div>
                <p className="text-[11px] text-slate-500">Valorisation temps réel (CoinGecko)</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Positions Actives</span>
                  <Layers className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {highlights.activePositionsCount}
                </div>
                <p className="text-[11px] text-slate-500">Actifs avec solde positif</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Positions en Staking</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                  {highlights.assetsWithStaking}
                </div>
                <p className="text-[11px] text-slate-500">Actifs générant des récompenses</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Positions en Lending</span>
                  <Percent className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-400 tracking-tight">
                  {highlights.assetsWithLending}
                </div>
                <p className="text-[11px] text-slate-500">Actifs placés en intérêts DeFi/CeFi</p>
              </div>
            </div>
          )}

          {/* Tableau des Positions Meria */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-md overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-base">Positions Détaillées — Meria</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Répartition précise entre disponibilité spot, staking verrouillé et lending
                </p>
              </div>
              {account?.lastUpdated && (
                <span className="text-[11px] text-slate-500">
                  Mis à jour : {new Date(account.lastUpdated).toLocaleTimeString("fr-FR")}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Crypto / Actif</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Disponible (Wallet)</th>
                    <th className="py-3.5 px-4 font-semibold text-right">En Staking</th>
                    <th className="py-3.5 px-4 font-semibold text-right">En Lending</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Total</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Valeur Estimée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          Chargement des positions depuis l&apos;API Meria...
                        </div>
                      </td>
                    </tr>
                  ) : !account || account.positions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        Aucune position active trouvée sur ce compte.
                      </td>
                    </tr>
                  ) : (
                    account.positions.map((pos) => (
                      <tr key={pos.symbol} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                              {pos.symbol.slice(0, 3)}
                            </div>
                            <div>
                              <span className="font-bold text-white">{pos.symbol}</span>
                              {pos.masternodesBalance && pos.masternodesBalance > 0 && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  Masternode: {pos.masternodesBalance.toFixed(4)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                          {pos.walletBalance > 0 ? pos.walletBalance.toLocaleString("fr-FR", { maximumFractionDigits: 8 }) : "0.00"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                          {pos.stakingBalance > 0 ? pos.stakingBalance.toLocaleString("fr-FR", { maximumFractionDigits: 8 }) : "0.00"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-purple-400">
                          {pos.lendingBalance > 0 ? pos.lendingBalance.toLocaleString("fr-FR", { maximumFractionDigits: 8 }) : "0.00"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                          {pos.totalBalance.toLocaleString("fr-FR", { maximumFractionDigits: 8 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-200">
                          {pos.totalValueEur ? formatCurrency(pos.totalValueEur) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ONGLET 2 : WALLETS ON-CHAIN */}
      {activeTab === "onchain" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-md overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Soldes Portefeuilles On-Chain
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Interrogation directe des RPC Cloudflare (ETH), Mempool (BTC), BlockCypher (DOGE) et XRPL (Ripple)
                </p>
              </div>
              <button
                onClick={() => setIsOnChainModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all self-start sm:self-auto"
              >
                Gérer les adresses publiques
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Actif</th>
                    <th className="py-3.5 px-4 font-semibold">Blockchain</th>
                    <th className="py-3.5 px-4 font-semibold">Adresse (abrégée)</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Solde</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Valeur Estimée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {onChainLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                          Interrogation des blockchains publiques en cours...
                        </div>
                      </td>
                    </tr>
                  ) : onChainBalances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <p>Aucune adresse configurée pour le moment.</p>
                        <button
                          onClick={() => setIsOnChainModalOpen(true)}
                          className="mt-2 text-xs text-cyan-400 underline hover:text-cyan-300 font-medium"
                        >
                          Ajouter vos adresses publiques (ETH, BTC, DOGE, XRP)
                        </button>
                      </td>
                    </tr>
                  ) : (
                    onChainBalances.map((item) => (
                      <tr key={`${item.blockchain}-${item.address}`} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                              {item.symbol}
                            </div>
                            <span className="font-bold text-white">{item.symbol}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          {item.blockchain}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400" title={item.address}>
                          {item.shortAddress}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-cyan-300">
                          {item.formattedBalance}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-200">
                          {item.totalValueEur ? formatCurrency(item.totalValueEur) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {onChainSyncDate && (
              <div className="p-3.5 bg-slate-950/40 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Synchronisation On-Chain réussie
                </span>
                <span>Dernière mise à jour : {onChainSyncDate}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Clé API Meria */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Clé API Meria</h3>
                <p className="text-xs text-slate-400">Authentification avec api.meria.com</p>
              </div>
            </div>

            <form onSubmit={handleSaveCustomKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Votre Clé API (API-KEY)
                </label>
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="Ex: meri_api_..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <p className="text-[11px] text-slate-500">
                  Vous pouvez également renseigner <code>MERIA_API_KEY</code> dans votre fichier <code>.env.local</code>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
                >
                  Valider et synchroniser
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Configuration Adresses On-Chain */}
      {isOnChainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Adresses Blockchains Publiques</h3>
                <p className="text-xs text-slate-400">Renseignez vos adresses ou xpub en lecture seule</p>
              </div>
            </div>

            <form onSubmit={handleSaveOnChainAddresses} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Ethereum (ETH)
                </label>
                <input
                  type="text"
                  value={onChainAddresses.eth || ""}
                  onChange={(e) => setOnChainAddresses({ ...onChainAddresses, eth: e.target.value })}
                  placeholder="0x..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Bitcoin (BTC) — Adresse ou xpub/zpub
                </label>
                <input
                  type="text"
                  value={onChainAddresses.btc || ""}
                  onChange={(e) => setOnChainAddresses({ ...onChainAddresses, btc: e.target.value })}
                  placeholder="bc1q... ou xpub/zpub..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" /> Dogecoin (DOGE)
                </label>
                <input
                  type="text"
                  value={onChainAddresses.doge || ""}
                  onChange={(e) => setOnChainAddresses({ ...onChainAddresses, doge: e.target.value })}
                  placeholder="D..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> XRP Ledger (Ripple)
                </label>
                <input
                  type="text"
                  value={onChainAddresses.xrp || ""}
                  onChange={(e) => setOnChainAddresses({ ...onChainAddresses, xrp: e.target.value })}
                  placeholder="r..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOnChainModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors"
                >
                  Interroger les blockchains
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
