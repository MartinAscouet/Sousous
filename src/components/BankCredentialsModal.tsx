"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
  KeyRound,
} from "lucide-react";
import {
  saveBankCredentialsAction,
  getBankCredentialsStatusAction,
  deleteBankCredentialsAction,
  BankCredentialPublicInfo,
} from "@/app/actions/bankCredentials";

interface BankCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SUPPORTED_BANKS = [
  { id: "cmb", name: "Crédit Mutuel de Bretagne (CMB)" },
  { id: "boursorama", name: "Boursorama Banque" },
  { id: "fortuneo", name: "Fortuneo" },
  { id: "cic", name: "CIC" },
  { id: "cm", name: "Crédit Mutuel (National)" },
  { id: "bnp", name: "BNP Paribas" },
  { id: "ca", name: "Crédit Agricole" },
  { id: "sg", name: "Société Générale" },
];

export default function BankCredentialsModal({
  isOpen,
  onClose,
  onSuccess,
}: BankCredentialsModalProps) {
  const [bankModule, setBankModule] = useState<string>("cmb");
  const [label, setLabel] = useState<string>("");
  const [login, setLogin] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [credentialsList, setCredentialsList] = useState<BankCredentialPublicInfo[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);

  const loadCredentials = async () => {
    setLoadingList(true);
    const res = await getBankCredentialsStatusAction();
    if (res.success && res.credentials) {
      setCredentialsList(res.credentials);
    }
    setLoadingList(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) {
      setError("Veuillez saisir votre identifiant et votre mot de passe.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const bankName = SUPPORTED_BANKS.find((b) => b.id === bankModule)?.name || bankModule;
    const res = await saveBankCredentialsAction({
      bankModule,
      label: label.trim() || bankName,
      login: login.trim(),
      password: password.trim(),
    });

    setSaving(false);

    if (res.success) {
      setSuccessMsg("Identifiants chiffrés et enregistrés avec succès !");
      setLogin("");
      setPassword("");
      setLabel("");
      loadCredentials();
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || "Une erreur est survenue lors de l'enregistrement.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cet accès bancaire ?")) return;
    setDeletingId(id);
    const res = await deleteBankCredentialsAction(id);
    setDeletingId(null);
    if (res.success) {
      loadCredentials();
      if (onSuccess) onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Gestion des accès bancaires</h3>
              <p className="text-xs text-slate-400">Chiffrement de bout en bout (AES-256-GCM)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Badge de sécurité */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-300/90 leading-relaxed">
              Vos identifiants sont chiffrés avec une clé symétrique AES-256 avant stockage dans la base Supabase et ne sont déchiffrés en mémoire qu&apos;au moment précis de la synchronisation.
            </div>
          </div>

          {/* Banques déjà connectées */}
          {credentialsList.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Comptes enregistrés
              </h4>
              <div className="space-y-2">
                {credentialsList.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-200">
                          {c.label || c.bankModule.toUpperCase()}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Module: {c.bankModule} • Ajouté le{" "}
                          {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      title="Supprimer l'accès"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulaire d'ajout */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ajouter ou mettre à jour un compte
            </h4>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Établissement Bancaire</label>
              <select
                value={bankModule}
                onChange={(e) => setBankModule(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {SUPPORTED_BANKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Nom d&apos;affichage (optionnel)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Mon Compte Courant CMB"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Identifiant / Numéro client
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Votre identifiant de connexion"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Mot de passe / Code secret</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Lock className="w-3.5 h-3.5" />
              {saving ? "Chiffrement & Sauvegarde..." : "Chiffrer et Enregistrer"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
