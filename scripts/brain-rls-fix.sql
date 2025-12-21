-- ============================================
-- FIX RLS POLICIES FOR ANON ACCESS
-- ============================================
-- Permitir acesso anon para brain_threads, brain_messages e brain_canvas_blocks

-- Remover policies existentes se houver conflito
DROP POLICY IF EXISTS "Allow anon insert on brain_threads" ON brain_threads;
DROP POLICY IF EXISTS "Allow anon select on brain_threads" ON brain_threads;
DROP POLICY IF EXISTS "Allow anon insert on brain_canvas_blocks" ON brain_canvas_blocks;
DROP POLICY IF EXISTS "Allow anon select on brain_canvas_blocks" ON brain_canvas_blocks;
DROP POLICY IF EXISTS "Allow anon insert on brain_messages" ON brain_messages;
DROP POLICY IF EXISTS "Allow anon select on brain_messages" ON brain_messages;

-- Policies para brain_threads
CREATE POLICY "Allow anon insert on brain_threads"
ON brain_threads FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon select on brain_threads"
ON brain_threads FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anon update on brain_threads"
ON brain_threads FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Policies para brain_canvas_blocks
CREATE POLICY "Allow anon insert on brain_canvas_blocks"
ON brain_canvas_blocks FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon select on brain_canvas_blocks"
ON brain_canvas_blocks FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anon update on brain_canvas_blocks"
ON brain_canvas_blocks FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Policies para brain_messages
CREATE POLICY "Allow anon insert on brain_messages"
ON brain_messages FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon select on brain_messages"
ON brain_messages FOR SELECT
TO anon
USING (true);

-- Também adicionar plan_id se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brain_canvas_blocks' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE brain_canvas_blocks ADD COLUMN plan_id UUID;
  END IF;
END $$;
