"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  Coins,
  PiggyBank,
  Building2,
  Gem,
  Search,
  Check,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";
import { AssetCategory } from "@/types/financial";

interface CategoryOption {
  id: AssetCategory;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  examples: string[];
}

const CATEGORIES: CategoryOption[] = [
  {
    id: "STOCK",
    title: "Bourse & ETF (PEA / CTO)",
    subtitle: "Actions d'entreprises, ETF World, Fonds d'investissement",
    icon: TrendingUp,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    examples: ["CW8.PA (Amundi MSCI World)", "MC.PA (LVMH)", "AAPL (Apple)"],
  },
  {
    id: "CRYPTO",
    title: "Crypto-monnaies",
    subtitle: "Bitcoin, Ethereum, Altcoins et Stablecoins",
    icon: Coins,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    examples: ["BTC (Bitcoin)", "ETH (Ethereum)", "SOL (Solana)"],
  },
  {
    id: "FIAT",
    title: "Comptes & Épargne",
    subtitle: "Comptes courants, Livret A, LDD, LEP, Fonds Euros",
    icon: PiggyBank,
    color: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/30",
    examples: ["Livret A Boursorama", "LDD Fortuneo", "Compte Courant BNP"],
  },
  {
    id: "REAL_ESTATE",
    title: "Immobilier & SCPI",
    subtitle: "Résidence principale, locatif, parts de SCPI, parkings",
    icon: Building2,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    examples: ["Appartement Paris 11", "Parts SCPI Primopierre"],
  },
  {
    id: "GOLD_COMMODITY",
    title: "Métaux précieux & Objets d'art",
    subtitle: "Or physique, lingots, pièces, montres de collection",
    icon: Gem,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    examples: ["Lingot d'Or 50g", "Napoléon 20 Francs"],
  },
];

export default function AddAssetPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [assetName, setAssetName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [accountName, setAccountName] = useState("PEA Boursorama");
  const [currency, setCurrency] = useState("EUR");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory);

  const handleSelectCategory = (catId: AssetCategory) => {
    setSelectedCategory(catId);
    // Préréglage de symboles ou noms selon la catégorie
    if (catId === "STOCK") {
      setSymbol("CW8.PA");
      setAssetName("Amundi MSCI World UCITS ETF");
    } else if (catId === "CRYPTO") {
      setSymbol("BTC");
      setAssetName("Bitcoin");
    } else if (catId === "FIAT") {
      setSymbol("EUR");
      setAssetName("Livret A");
    } else if (catId === "REAL_ESTATE") {
      setSymbol("IMMO");
      setAssetName("Appartement T2");
    } else {
      setSymbol("GOLD");
      setAssetName("Lingot Or 50g");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulation d'enregistrement de l'actif
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Ajouter un Actif
            </h1>
            <p className="text-xs text-slate-400">
              Étape {selectedCategory ? "2/2 : Détails de la position" : "1/2 : Sélection de la catégorie"}
            </p>
          </div>
        </div>
      </div>

      {/* STEP 1: Choisir la catégorie d'actif */}
      {!selectedCategory ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">
              Sélectionnez le type d&apos;actif à ajouter
            </h2>
            <p className="text-xs text-slate-400">
              Choisissez une catégorie pour personnaliser les champs de saisie.
            </p>
          </div>

          {/* Search filter for categories */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Rechercher une catégorie (ex: ETF, Crypto, SCPI)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CATEGORIES.filter((cat) =>
              cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              cat.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
            ).map((cat) => {
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`p-6 rounded-2xl border bg-slate-900/60 hover:bg-slate-900 transition-all text-left group flex flex-col justify-between space-y-4 ${cat.borderColor} hover:scale-[1.01]`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-center gap-3.5">
                      <div className={`p-3 rounded-xl ${cat.bgColor} ${cat.color} border ${cat.borderColor}`}>
                        <IconComp className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {cat.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{cat.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 mr-1">
                      Exemples :
                    </span>
                    {cat.examples.map((ex, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* STEP 2: Renseigner les détails de l'actif */
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Header de la catégorie choisie */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-3">
              {activeCategoryObj && (
                <div
                  className={`p-2.5 rounded-xl ${activeCategoryObj.bgColor} ${activeCategoryObj.color}`}
                >
                  <activeCategoryObj.icon className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Catégorie sélectionnée
                </span>
                <h2 className="text-base font-bold text-white">
                  {activeCategoryObj?.title}
                </h2>
              </div>
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs text-slate-400 hover:text-white underline underline-offset-4"
            >
              Changer
            </button>
          </div>

          {success && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-400" />
              Actif enregistré avec succès ! Redirection vers le tableau de bord...
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
            {/* Compte rattaché */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Compte ou Portefeuille rattaché
              </label>
              <select
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="PEA Boursorama">PEA Boursorama</option>
                <option value="Compte Courant BNP">Compte Courant BNP</option>
                <option value="Livret A Fortuneo">Livret A Fortuneo</option>
                <option value="Ledger Nano X (Wallet Crypto)">Ledger Nano X (Wallet Crypto)</option>
                <option value="Binance Account">Binance Account</option>
                <option value="Patrimoine Immobilier">Patrimoine Immobilier</option>
              </select>
            </div>

            {/* Nom de l'actif & Ticker */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Nom de l&apos;actif
                </label>
                <input
                  type="text"
                  required
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="ex: Amundi MSCI World ETF"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Ticker / Symbole
                </label>
                <input
                  type="text"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="ex: CW8.PA ou BTC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>
            </div>

            {/* Quantité & Prix d'achat PRM */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Quantité détenue
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="ex: 15.5"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Prix d&apos;Achat Unitaire (PRM)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="ex: 512.40"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Devise
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="CHF">CHF (CHF)</option>
                  <option value="BTC">BTC (₿)</option>
                </select>
              </div>
            </div>

            {/* Remarque précision financière */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Données stockées en précision exacte <code className="text-emerald-400 font-mono">numeric(18, 8)</code> dans PostgreSQL Supabase.
              </span>
            </div>

            {/* Actions Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={submitting || success}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                {submitting ? "Enregistrement..." : "Ajouter cet actif"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
