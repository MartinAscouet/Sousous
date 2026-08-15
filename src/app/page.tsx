import Link from "next/link";
import { ArrowRight, ShieldCheck, Wallet, LineChart, Building2 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-emerald-400">
          <Wallet className="h-6 w-6 text-emerald-400" />
          <span>Sousous</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-colors flex items-center gap-1.5"
          >
            Accéder au Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-20 text-center flex flex-col items-center gap-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" /> 100% Privé, Sécurisé & Autohébergé
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Centralisez et analysez l&apos;ensemble de votre{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            patrimoine financier
          </span>
        </h1>

        <p className="text-slate-400 text-lg md:text-xl max-w-2xl font-normal">
          Comptes courants, Livrets, PEA, Portefeuilles Crypto et Immobilier. Visualisez votre allocation et votre valorisation nette en temps réel.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition-all shadow-lg shadow-emerald-500/20 text-sm flex items-center gap-2"
          >
            Ouvrir mon Tableau de Bord <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-16 text-left">
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur">
            <LineChart className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Bourse & ETF</h3>
            <p className="text-slate-400 text-sm">
              Mise à jour automatique des cours via Yahoo Finance (CW8, WCE, Actions).
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur">
            <Wallet className="w-8 h-8 text-teal-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Portefeuille Crypto</h3>
            <p className="text-slate-400 text-sm">
              Intégration API CoinGecko pour suivre Bitcoin, Ethereum et vos altcoins.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur">
            <Building2 className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Immobilier & Banques</h3>
            <p className="text-slate-400 text-sm">
              Suivi précis des comptes de dépôt, livrets réglementés et biens immobiliers.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-6 text-center text-xs text-slate-500">
        Sousous — Dashboard de Patrimoine Multi-Actifs • Développé selon AGENT.MD
      </footer>
    </div>
  );
}
