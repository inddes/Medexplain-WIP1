/*
  # MedExplain Database Schema

  1. New Tables
    - `app_admins` - Admin users table
    - `sources` - Data sources (FDA, CPIC, PharmGKB)
    - `drugs` - Drug information
    - `genes` - Gene information
    - `variants` - Gene variants
    - `phenotypes` - Phenotype classifications
    - `guidelines` - Clinical guidelines
    - `interactions` - Drug-gene interactions
    - `citations` - Research citations
    - `saved_answers` - User saved queries
    - `usage_monthly` - Usage tracking
    - `ingestion_jobs` - Data ingestion job tracking
    - `audit_log` - Audit trail

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users to access their own data
    - Admin-only policies for admin tables
    - Public read access for reference data
*/

-- App admins table (created first to avoid circular dependency)
CREATE TABLE IF NOT EXISTS app_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read app_admins"
  ON app_admins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins aa
      WHERE aa.user_id = auth.uid()
    )
  );

-- Sources table
CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sources"
  ON sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert sources"
  ON sources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update sources"
  ON sources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete sources"
  ON sources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );

-- Drugs table
CREATE TABLE IF NOT EXISTS drugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  aliases text[],
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read drugs"
  ON drugs FOR SELECT
  TO authenticated
  USING (true);

-- Genes table
CREATE TABLE IF NOT EXISTS genes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  name text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE genes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read genes"
  ON genes FOR SELECT
  TO authenticated
  USING (true);

-- Variants table
CREATE TABLE IF NOT EXISTS variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gene_id uuid REFERENCES genes(id) ON DELETE CASCADE,
  name text NOT NULL,
  rsid text,
  allele text,
  function text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read variants"
  ON variants FOR SELECT
  TO authenticated
  USING (true);

-- Phenotypes table
CREATE TABLE IF NOT EXISTS phenotypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gene_id uuid REFERENCES genes(id) ON DELETE CASCADE,
  phenotype text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE phenotypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read phenotypes"
  ON phenotypes FOR SELECT
  TO authenticated
  USING (true);

-- Guidelines table
CREATE TABLE IF NOT EXISTS guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id uuid REFERENCES drugs(id) ON DELETE CASCADE,
  gene_id uuid REFERENCES genes(id) ON DELETE CASCADE,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  recommendation text,
  evidence_level text,
  patient_summary text,
  clinician_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read guidelines"
  ON guidelines FOR SELECT
  TO authenticated
  USING (true);

-- Interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id uuid REFERENCES drugs(id) ON DELETE CASCADE,
  gene_id uuid REFERENCES genes(id) ON DELETE CASCADE,
  phenotype_id uuid REFERENCES phenotypes(id) ON DELETE SET NULL,
  guideline_id uuid REFERENCES guidelines(id) ON DELETE SET NULL,
  action text,
  summary text,
  evidence text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read interactions"
  ON interactions FOR SELECT
  TO authenticated
  USING (true);

-- Citations table
CREATE TABLE IF NOT EXISTS citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id uuid REFERENCES guidelines(id) ON DELETE CASCADE,
  title text,
  authors text,
  journal text,
  year integer,
  doi text,
  pmid text,
  url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read citations"
  ON citations FOR SELECT
  TO authenticated
  USING (true);

-- Saved answers table
CREATE TABLE IF NOT EXISTS saved_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  drug_name text NOT NULL,
  gene_name text NOT NULL,
  user_type text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved answers"
  ON saved_answers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved answers"
  ON saved_answers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved answers"
  ON saved_answers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Usage monthly table
CREATE TABLE IF NOT EXISTS usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL,
  query_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE usage_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage"
  ON usage_monthly FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON usage_monthly FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON usage_monthly FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ingestion jobs table
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  records_processed integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ingestion jobs"
  ON ingestion_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert ingestion jobs"
  ON ingestion_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_drugs_name ON drugs(name);
CREATE INDEX IF NOT EXISTS idx_genes_symbol ON genes(symbol);
CREATE INDEX IF NOT EXISTS idx_variants_gene_id ON variants(gene_id);
CREATE INDEX IF NOT EXISTS idx_phenotypes_gene_id ON phenotypes(gene_id);
CREATE INDEX IF NOT EXISTS idx_guidelines_drug_gene ON guidelines(drug_id, gene_id);
CREATE INDEX IF NOT EXISTS idx_interactions_drug_gene ON interactions(drug_id, gene_id);
CREATE INDEX IF NOT EXISTS idx_citations_guideline_id ON citations(guideline_id);
CREATE INDEX IF NOT EXISTS idx_saved_answers_user_id ON saved_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_monthly_user_month ON usage_monthly(user_id, month);
CREATE INDEX IF NOT EXISTS idx_app_admins_user_id ON app_admins(user_id);
