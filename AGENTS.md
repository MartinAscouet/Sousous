# AGENT.MD — Assistant de Développement : Portfolio & Wealth Dashboard

Ce document définit le contexte, les choix architecturaux, les standards de code et les règles métier pour le développement de l'application de suivi de patrimoine multi-actifs.

---

## 1. Vue d'ensemble du Projet

* **Nom du projet :** Sousous / Agrégateur de Patrimoine
* **Objectif :** Application web responsive et PWA permettant de centraliser, valoriser et analyser l'ensemble des actifs d'un utilisateur (Comptes courants, Livrets, PEA / Actions / ETF, Portefeuille Crypto, Immobilier/Autres).
* **Cibles :** Ordinateur (Desktop) et Mobile (iOS / Android via PWA).
* **Modèle d'hébergement :** 100% gratuit (Vercel Hobby + Supabase Free Tier).

---

## 2. Stack Technique & Écosystème

| Rôle | Technologie |
|---|---|
| **Framework Full-Stack** | Next.js (App Router, React Server Components, Server Actions) |
| **Langage** | TypeScript (mode strict activé) |
| **Base de données & Auth** | Supabase (PostgreSQL avec Row Level Security - RLS) |
| **ORM** | Drizzle ORM (`drizzle-kit` pour les migrations) |
| **UI & Styling** | Tailwind CSS + shadcn/ui + Lucide React |
| **Data Visualization** | shadcn/ui Charts (basé sur Recharts) |
| **PWA** | `@ducanh2912/next-pwa` ou `@serwist/next` |
| **Données Financières** | `yahoo-finance2` (Bourse/PEA), API CoinGecko (Crypto) |
| **Import de fichiers** | `papaparse` (Import CSV pour courtiers et relevés bancaires) |
| **Tâches planifiées** | Vercel Cron Jobs (Snapshot de valorisation quotidienne) |

---

## 3. Directives d'Architecture & Structure des Dossiers

L'application suit la convention standard de Next.js App Router :

```text
src/
├── app/
│   ├── (auth)/             # Pages de connexion / inscription
│   ├── (dashboard)/        # Layout principal et sous-pages (PEA, Crypto, Banques, Paramètres)
│   ├── api/
│   │   ├── cron/           # Route Handlers pour les tâches automatisées (ex: snapshot journalier)
│   │   └── webhooks/       # Endpoints de synchronisation externe
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                 # Composants atomiques shadcn/ui (Card, Button, Dialog, etc.)
│   ├── dashboard/          # Vues spécialisées (AllocationPie, NetWorthCard, PerformanceChart)
│   └── forms/              # Formulaires d'ajout manuel de transaction / compte
├── db/
│   ├── schema/             # Schémas Drizzle ORM (accounts, assets, transactions, snapshots)
│   ├── index.ts            # Client Drizzle initialisé avec postgres-js
│   └── migrations/
├── lib/
│   ├── api/                # Wrappers d'APIs externes (yahoo-finance, coingecko)
│   ├── supabase/           # Clients Supabase (client-side, server-side, middleware)
│   └── utils.ts            # Helpers de calculs financiers, formats monétaires
└── types/                  # Types TypeScript partagés

## 4. Règles Métier & Standards de Développement
### 4.1. Précision Financière & Devises
Ne jamais stocker de valeurs monétaires sous forme de nombres flottants imprécis (FLOAT en SQL).

Utiliser NUMERIC(18, 8) dans PostgreSQL / Drizzle pour gérer à la fois les montants fiduciaires (centimes d'euros) et les fractions de crypto-monnaies (satoshis).

Toutes les valorisations doivent pouvoir être converties dans une devise de base (par défaut : EUR).

Toujours formater les montants côté client avec Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).

### 4.2. Sécurité & Backend
Secrets protégés : Toutes les clés d'API, clés de service Supabase et tokens externes doivent impérativement rester côté serveur (process.env.SECRET_KEY).

Row-Level Security (RLS) : Chaque table Supabase contenant des données utilisateur doit avoir le RLS activé avec une politique auth.uid() = user_id.

Server Actions : Privilégier les Server Actions Next.js pour les mutations (création d'un compte, ajout d'une ligne d'actif, mise à jour du profil).

Route Handlers sécurisés : Les routes de cron (/api/cron/*) doivent valider le header Authorization: Bearer ${process.env.CRON_SECRET}.

### 3. Interface Utilisateur & Responsive (Mobile-First)
L'interface doit être conçue en priorité pour un écran de smartphone (navigation par barre inférieure ou tiroir Sheet shadcn/ui), tout en s'adaptant élégamment sur grand écran (barre latérale fixe).

Les graphiques doivent être fluides sur tactile : utiliser ResponsiveContainer de Recharts avec des tooltips adaptés au doigt.

Prévoir un support complet du thème sombre (next-themes + Tailwind dark:).

## 5. Modèle de Données (Concepts Clés)
accounts : Comptes d'un utilisateur (ex: "PEA Boursorama", "Compte Courant BNP", "Wallet Ledger").

assets : Référentiel des actifs détenus (ex: Ticker CW8.PA pour un ETF World, BTC pour Bitcoin).

holdings / positions : Quantité d'un actif détenu dans un compte donné + Prix de Revient Moyen (PRM).

transactions : Historique des achats, ventes, dividendes, dépôts et retraits.

portfolio_snapshots : Valeur totale nette enregistrée chaque jour pour tracer la courbe historique de patrimoine.

## 6. Consignes pour l'IA Collaboratrice
Lorsque tu génères du code ou réponds à des demandes sur ce projet :

Fournis du code complet et typé : Définis systématiquement les interfaces TypeScript et importe les modules requis.

Priorise les Server Components : Effectue les récupérations de données en Server Component sauf si une interactivité cliente (état local, écouteurs d'événements) est indispensable ("use client").

Respecte la modularité shadcn/ui : Utilise les primitives existantes de shadcn/ui plutôt que de réécrire des composants HTML natifs bruts.

Optimise les appels d'API externes : Met en cache les cours de bourse et de crypto (via Next.js fetch(..., { next: { revalidate: 300 } }) ou table temporaire) pour ne pas saturer les limites des plans gratuits.