import {
  Wallet,
  TrendingUp,
  PiggyBank,
  Building2,
  Coins,
  ArrowUpRight,
  PlusCircle,
  RefreshCw,
  PieChart as PieChartIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  // Données financières initiales de démonstration
  const mockNetWorth = 124850.5;
  const mockCash = 15400.0;
  const mockStocks = 68450.25;
  const mockCrypto = 16000.25;
  const mockRealEstate = 25000.0;

  // Calcul des pourcentages de répartition
  const cashPct = ((mockCash / mockNetWorth) * 100).toFixed(1);
  const stocksPct = ((mockStocks / mockNetWorth) * 100).toFixed(1);
  const cryptoPct = ((mockCrypto / mockNetWorth) * 100).toFixed(1);
  const realEstatePct = ((mockRealEstate / mockNetWorth) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-emerald-400" />
            Tableau de Bord
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            Vue synthétique et valorisation globale de vos actifs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" /> Actualiser les cours
          </button>
          <button className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
            <PlusCircle className="w-4 h-4" /> Ajouter un actif
          </button>
        </div>
      </div>

      {/* 🌟 HAUT DE PAGE : PATRIMOINE NET TOTAL EN GRAND */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 p-8 md:p-12 shadow-2xl shadow-emerald-950/30">
        {/* Glow décoratif d'arrière-plan */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              Patrimoine Net Total
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              <ArrowUpRight className="w-4 h-4" /> +2 926,40 € (+2,4%) ce mois
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight">
              {formatCurrency(mockNetWorth)}
            </div>
            <p className="text-slate-400 text-xs md:text-sm font-normal">
              Valorisation agrégée incluant 4 comptes bancaires et portefeuilles
            </p>
          </div>

          {/* Barre visuelle de répartition d'actifs */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>Répartition globale</span>
              <span>100% valorisé</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-950 p-0.5 flex overflow-hidden border border-slate-800">
              <div
                style={{ width: `${stocksPct}%` }}
                className="h-full bg-emerald-400 rounded-l-full"
                title={`Bourse: ${stocksPct}%`}
              />
              <div
                style={{ width: `${realEstatePct}%` }}
                className="h-full bg-cyan-400"
                title={`Immobilier: ${realEstatePct}%`}
              />
              <div
                style={{ width: `${cryptoPct}%` }}
                className="h-full bg-amber-400"
                title={`Crypto: ${cryptoPct}%`}
              />
              <div
                style={{ width: `${cashPct}%` }}
                className="h-full bg-teal-300 rounded-r-full"
                title={`Épargne: ${cashPct}%`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 🔽 EN DESSOUS : SOUS-CLASSES D'ACTIFS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-emerald-400" />
            Répartition par Classe d&apos;Actif
          </h2>
          <span className="text-xs text-slate-400">4 catégories d&apos;actifs</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Bourse & PEA */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {stocksPct}%
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                PEA & Action
              </span>
              <div className="text-2xl font-bold text-white tracking-tight mt-1">
                {formatCurrency(mockStocks)}
              </div>
            </div>
            <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-3">
              ETF World CW8, Actions LVMH, Total
            </div>
          </div>

          {/* Card 2: Immobilier */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {realEstatePct}%
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Immobilier & SCPI
              </span>
              <div className="text-2xl font-bold text-white tracking-tight mt-1">
                {formatCurrency(mockRealEstate)}
              </div>
            </div>
            <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-3">
              Résidence principale & Parts SCPI
            </div>
          </div>

          {/* Card 3: Portefeuille Crypto */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Coins className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {cryptoPct}%
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Portefeuille Crypto
              </span>
              <div className="text-2xl font-bold text-white tracking-tight mt-1">
                {formatCurrency(mockCrypto)}
              </div>
            </div>
            <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-3">
              Bitcoin, Ethereum & Ledger Wallet
            </div>
          </div>

          {/* Card 4: Comptes & Épargne */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <PiggyBank className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                {cashPct}%
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Comptes & Épargne
              </span>
              <div className="text-2xl font-bold text-white tracking-tight mt-1">
                {formatCurrency(mockCash)}
              </div>
            </div>
            <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-3">
              Livret A, LDD & Compte Courant BNP
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
