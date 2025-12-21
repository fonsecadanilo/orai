-- ============================================
-- BRAIN TABLES MIGRATION
-- ============================================
-- Execute este script no Supabase SQL Editor para criar
-- as tabelas necessárias para o Brain Router.

-- ============================================
-- 1. BRAIN THREADS
-- ============================================
CREATE TABLE IF NOT EXISTS brain_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  messages_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster project lookups
CREATE INDEX IF NOT EXISTS idx_brain_threads_project ON brain_threads(project_id);
CREATE INDEX IF NOT EXISTS idx_brain_threads_user ON brain_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_brain_threads_status ON brain_threads(status);

-- ============================================
-- 2. BRAIN MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS brain_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES brain_threads(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  structured_output JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster thread lookups
CREATE INDEX IF NOT EXISTS idx_brain_messages_thread ON brain_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_brain_messages_created ON brain_messages(created_at);

-- ============================================
-- 3. BRAIN CANVAS BLOCKS
-- ============================================
CREATE TABLE IF NOT EXISTS brain_canvas_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  thread_id UUID REFERENCES brain_threads(id) ON DELETE CASCADE,
  block_type TEXT DEFAULT 'brain_chat',
  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,
  width REAL DEFAULT 400,
  height REAL DEFAULT 300,
  streaming BOOLEAN DEFAULT FALSE,
  content TEXT DEFAULT '',
  mode TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster thread lookups
CREATE INDEX IF NOT EXISTS idx_brain_canvas_blocks_thread ON brain_canvas_blocks(thread_id);
CREATE INDEX IF NOT EXISTS idx_brain_canvas_blocks_project ON brain_canvas_blocks(project_id);

-- ============================================
-- 4. BRAIN MIGRATIONS (para tracking de migrations sugeridas)
-- ============================================
CREATE TABLE IF NOT EXISTS brain_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  migration_name TEXT NOT NULL,
  sql_content TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'rejected')),
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_brain_migrations_project ON brain_migrations(project_id);
CREATE INDEX IF NOT EXISTS idx_brain_migrations_status ON brain_migrations(status);

-- ============================================
-- 5. PRODUCT PROFILES (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS product_profiles (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  product_type TEXT DEFAULT 'saas',
  industry TEXT,
  business_model TEXT,
  main_value_proposition TEXT,
  key_features JSONB DEFAULT '[]'::jsonb,
  target_audience TEXT,
  maturity_stage TEXT DEFAULT 'mvp',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_profiles_project ON product_profiles(project_id);

-- ============================================
-- 6. PERSONAS (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS personas (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  role_scope TEXT DEFAULT 'member',
  permissions JSONB DEFAULT '[]'::jsonb,
  restrictions JSONB DEFAULT '[]'::jsonb,
  typical_goals JSONB DEFAULT '[]'::jsonb,
  pain_points JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_personas_project ON personas(project_id);

-- ============================================
-- 7. BUSINESS RULES (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS business_rules (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  description TEXT,
  conditions JSONB DEFAULT '{}'::jsonb,
  actions JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'deprecated')),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_rules_project ON business_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_business_rules_status ON business_rules(status);

-- ============================================
-- 8. FLOW REGISTRY (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS flow_registry (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  flow_id TEXT NOT NULL,
  flow_name TEXT NOT NULL,
  flow_type TEXT NOT NULL,
  entry_node_id TEXT,
  exit_node_ids JSONB DEFAULT '[]'::jsonb,
  node_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, flow_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_registry_project ON flow_registry(project_id);

-- ============================================
-- 9. FLOW SPECS (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS flow_specs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  flow_id TEXT NOT NULL,
  spec_name TEXT NOT NULL,
  spec_content JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_specs_project ON flow_specs(project_id);
CREATE INDEX IF NOT EXISTS idx_flow_specs_flow ON flow_specs(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_specs_latest ON flow_specs(is_latest);

-- ============================================
-- 10. FLOWS (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flows_project ON flows(project_id);

-- ============================================
-- RLS POLICIES (Row Level Security)
-- ============================================
-- Habilitar RLS nas tabelas
ALTER TABLE brain_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_canvas_blocks ENABLE ROW LEVEL SECURITY;

-- Policies permissivas para service role (Edge Functions)
-- Em produção, adicionar policies mais restritivas baseadas em auth.uid()

CREATE POLICY "Service role full access on brain_threads"
ON brain_threads FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access on brain_messages"
ON brain_messages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access on brain_canvas_blocks"
ON brain_canvas_blocks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- REALTIME (para streaming updates)
-- ============================================
-- Habilitar realtime para canvas_blocks (streaming updates)
ALTER PUBLICATION supabase_realtime ADD TABLE brain_canvas_blocks;

-- ============================================
-- DONE
-- ============================================
-- Migration completa! As seguintes tabelas foram criadas/verificadas:
-- - brain_threads: Threads de conversa do Brain
-- - brain_messages: Mensagens das conversas
-- - brain_canvas_blocks: Blocos do Brain no canvas
-- - brain_migrations: Migrations sugeridas pelo Brain
-- - product_profiles: Perfil do produto
-- - personas: Personas/roles do projeto
-- - business_rules: Regras de negócio
-- - flow_registry: Registry de fluxos
-- - flow_specs: Especificações de fluxos
-- - flows: Fluxos do projeto


