import { Wallet, TrendingUp, PiggyBank, Building, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  // Exemple de données d'agrégation de démonstration initiales
  const mockNetWorth = "124850.50";
  const mockCash = "15400.00";
  const mockStocks = "68450.25";
  const mockCrypto = "16000.25";
  const mockRealEstate = "25000.00";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Tableau de Bord</h1>
          <p className="text-sm text-slate-400">Synthèse et répartition globale de votre patrimoine</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center gap-1.5">
            + Ajouter un Compte / Actif
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Patrimoine Net Total</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(mockNetWorth)}
          </div>
          <div className="text-xs text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +2.4% ce mois
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Comptes & Epargne</span>
            <PiggyBank className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(mockCash)}
          </div>
          <div className="text-xs text-slate-500">Livret A, LDD, Comptes courants</div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">PEA & Bourse</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(mockStocks)}
          </div>
          <div className="text-xs text-slate-500">ETF World CW8, Actions</div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Crypto & Immobilier</span>
            <Building className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(parseFloat(mockCrypto) + parseFloat(mockRealEstate))}
          </div>
          <div className="text-xs text-slate-500">BTC, ETH & Parts SCPI</div>
        </div>
      </div>

      {/* Main Content Placeholder */}
      <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/40 text-center space-y-3">
        <h2 className="text-lg font-semibold text-white">Structure du Projet Prête & Sécurisée</h2>
        <p className="text-slate-400 text-sm max-w-xl mx-auto">
          Les schémas Drizzle ORM avec <code className="text-emerald-400 font-mono text-xs">numeric(18, 8)</code>, les clients Supabase SSR avec cookies sécurisés et les politiques Row-Level Security (RLS) sont prêts.
        </p>
      </div>
    </div>
  );
}
