-- ================================================================
-- Table balance_snapshots : Historisation et Calcul de Performance
-- ================================================================

CREATE TABLE IF NOT EXISTS public.balance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL, -- 'total', 'saxo_pea', 'amundi_pee', 'crypto', 'banking', 'realestate'
    total_value NUMERIC(18, 8) NOT NULL DEFAULT 0,
    cash_balance NUMERIC(18, 8),
    invested_value NUMERIC(18, 8),
    snapshot_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index composite optimisé pour les requêtes de variation temporelle (ORDER BY snapshot_date DESC)
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_account_date 
ON public.balance_snapshots (account_id, snapshot_date DESC);

-- Activation de Row Level Security (RLS)
ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

-- Politique d'accès par défaut (permettre la lecture et l'insertion)
CREATE POLICY "Allow public read access on balance_snapshots"
ON public.balance_snapshots
FOR SELECT
USING (true);

CREATE POLICY "Allow service role full access on balance_snapshots"
ON public.balance_snapshots
FOR ALL
USING (true)
WITH CHECK (true);
