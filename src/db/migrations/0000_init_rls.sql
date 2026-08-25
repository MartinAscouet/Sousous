-- Activation de la Row Level Security (RLS) sur toutes les tables de l'application
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité RLS basées sur auth.uid() = user_id

-- Table ACCOUNTS
CREATE POLICY "Utilisateur peut uniquement lire ses comptes"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement insérer ses comptes"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement modifier ses comptes"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement supprimer ses comptes"
  ON accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Table ASSETS
CREATE POLICY "Utilisateur peut uniquement lire ses actifs"
  ON assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement insérer ses actifs"
  ON assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement modifier ses actifs"
  ON assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement supprimer ses actifs"
  ON assets FOR DELETE
  USING (auth.uid() = user_id);

-- Table HOLDINGS
CREATE POLICY "Utilisateur peut uniquement lire ses positions"
  ON holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement insérer ses positions"
  ON holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement modifier ses positions"
  ON holdings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement supprimer ses positions"
  ON holdings FOR DELETE
  USING (auth.uid() = user_id);

-- Table TRANSACTIONS
CREATE POLICY "Utilisateur peut uniquement lire ses transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement insérer ses transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement modifier ses transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement supprimer ses transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Table PORTFOLIO_SNAPSHOTS
CREATE POLICY "Utilisateur peut uniquement lire ses snapshots"
  ON portfolio_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut uniquement insérer ses snapshots"
  ON portfolio_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Table OAUTH_TOKENS
ALTER TABLE IF EXISTS oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur ou service peut lire les oauth_tokens"
  ON oauth_tokens FOR SELECT
  USING (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Utilisateur ou service peut insérer les oauth_tokens"
  ON oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Utilisateur ou service peut modifier les oauth_tokens"
  ON oauth_tokens FOR UPDATE
  USING (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Utilisateur ou service peut supprimer les oauth_tokens"
  ON oauth_tokens FOR DELETE
  USING (auth.uid() IS NULL OR auth.uid() = user_id);
