-- ============================================
-- BRAIN PHASE 4 MIGRATION
-- Canvas Edges + RLS Policies
-- ============================================

-- ============================================
-- 1. CREATE canvas_edges TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.canvas_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Source
    source_type TEXT NOT NULL CHECK (source_type IN ('flow_node', 'canvas_block')),
    source_id TEXT NOT NULL,
    source_handle TEXT DEFAULT 'default',
    
    -- Target
    target_type TEXT NOT NULL CHECK (target_type IN ('flow_node', 'canvas_block')),
    target_id TEXT NOT NULL,
    target_handle TEXT DEFAULT 'default',
    
    -- Edge metadata
    edge_type TEXT NOT NULL DEFAULT 'reference' CHECK (edge_type IN (
        'reference',        -- Referência genérica
        'explains',         -- Brain explica um node
        'depends_on',       -- Dependência lógica
        'continuation',     -- Brain -> Brain (continua conversa)
        'generated_from',   -- Flow gerado pelo Brain
        'rule_applies_to'   -- Regra aplicada a node/flow
    )),
    
    label TEXT,
    style JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    
    -- Constraints
    CONSTRAINT unique_canvas_edge UNIQUE (project_id, source_type, source_id, target_type, target_id, edge_type)
);

-- Indexes for canvas_edges
CREATE INDEX IF NOT EXISTS idx_canvas_edges_project ON public.canvas_edges(project_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_source ON public.canvas_edges(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_target ON public.canvas_edges(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_type ON public.canvas_edges(edge_type);

-- Comment
COMMENT ON TABLE public.canvas_edges IS 'Conexões entre Brain Blocks e Flow Nodes no canvas (separadas das connections do flow)';

-- ============================================
-- 2. RLS POLICIES FOR BRAIN TABLES
-- ============================================

-- Enable RLS on all brain tables
ALTER TABLE public.brain_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_canvas_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_flow_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_flow_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_edges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe to run multiple times)
DROP POLICY IF EXISTS "brain_threads_service_role" ON public.brain_threads;
DROP POLICY IF EXISTS "brain_threads_authenticated_read" ON public.brain_threads;
DROP POLICY IF EXISTS "brain_threads_authenticated_write" ON public.brain_threads;

DROP POLICY IF EXISTS "brain_messages_service_role" ON public.brain_messages;
DROP POLICY IF EXISTS "brain_messages_authenticated_read" ON public.brain_messages;
DROP POLICY IF EXISTS "brain_messages_authenticated_write" ON public.brain_messages;

DROP POLICY IF EXISTS "brain_canvas_blocks_service_role" ON public.brain_canvas_blocks;
DROP POLICY IF EXISTS "brain_canvas_blocks_authenticated_read" ON public.brain_canvas_blocks;
DROP POLICY IF EXISTS "brain_canvas_blocks_authenticated_write" ON public.brain_canvas_blocks;

DROP POLICY IF EXISTS "brain_flow_plans_service_role" ON public.brain_flow_plans;
DROP POLICY IF EXISTS "brain_flow_plans_authenticated_read" ON public.brain_flow_plans;
DROP POLICY IF EXISTS "brain_flow_plans_authenticated_write" ON public.brain_flow_plans;

DROP POLICY IF EXISTS "brain_flow_plan_versions_service_role" ON public.brain_flow_plan_versions;
DROP POLICY IF EXISTS "brain_flow_plan_versions_authenticated_read" ON public.brain_flow_plan_versions;

DROP POLICY IF EXISTS "brain_migrations_service_role" ON public.brain_migrations;
DROP POLICY IF EXISTS "brain_migrations_authenticated_read" ON public.brain_migrations;

DROP POLICY IF EXISTS "canvas_edges_service_role" ON public.canvas_edges;
DROP POLICY IF EXISTS "canvas_edges_authenticated_read" ON public.canvas_edges;
DROP POLICY IF EXISTS "canvas_edges_authenticated_write" ON public.canvas_edges;

-- ============================================
-- brain_threads policies
-- ============================================

CREATE POLICY "brain_threads_service_role" ON public.brain_threads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "brain_threads_authenticated_read" ON public.brain_threads
    FOR SELECT
    TO authenticated
    USING (true); -- TODO: Add project membership check when auth is implemented

CREATE POLICY "brain_threads_authenticated_write" ON public.brain_threads
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- brain_messages policies
-- ============================================

CREATE POLICY "brain_messages_service_role" ON public.brain_messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "brain_messages_authenticated_read" ON public.brain_messages
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "brain_messages_authenticated_write" ON public.brain_messages
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- brain_canvas_blocks policies
-- ============================================

CREATE POLICY "brain_canvas_blocks_service_role" ON public.brain_canvas_blocks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "brain_canvas_blocks_authenticated_read" ON public.brain_canvas_blocks
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "brain_canvas_blocks_authenticated_write" ON public.brain_canvas_blocks
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- brain_flow_plans policies
-- ============================================

CREATE POLICY "brain_flow_plans_service_role" ON public.brain_flow_plans
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "brain_flow_plans_authenticated_read" ON public.brain_flow_plans
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "brain_flow_plans_authenticated_write" ON public.brain_flow_plans
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- brain_flow_plan_versions policies
-- ============================================

CREATE POLICY "brain_flow_plan_versions_service_role" ON public.brain_flow_plan_versions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "brain_flow_plan_versions_authenticated_read" ON public.brain_flow_plan_versions
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================
-- brain_migrations policies
-- ============================================

CREATE POLICY "brain_migrations_service_role" ON public.brain_migrations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "brain_migrations_authenticated_read" ON public.brain_migrations
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================
-- canvas_edges policies
-- ============================================

CREATE POLICY "canvas_edges_service_role" ON public.canvas_edges
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "canvas_edges_authenticated_read" ON public.canvas_edges
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "canvas_edges_authenticated_write" ON public.canvas_edges
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 3. ENABLE REALTIME FOR canvas_edges
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.canvas_edges;

-- ============================================
-- 4. UPDATE TRIGGER FOR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_canvas_edges_updated_at ON public.canvas_edges;
CREATE TRIGGER update_canvas_edges_updated_at
    BEFORE UPDATE ON public.canvas_edges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE
-- ============================================

