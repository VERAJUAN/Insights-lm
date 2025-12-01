-- ============================================================================
-- Remove public access to sources and notes for public notebooks
-- Public users (not logged in) should only be able to chat, not view sources/notes
-- This gives them the same permissions as a "reader" role
-- ============================================================================

-- Remove policy that allows public users to view sources of public notebooks
DROP POLICY IF EXISTS "Public notebook sources are readable by anyone" ON public.sources;

-- Remove policy that allows public users to view notes of public notebooks
DROP POLICY IF EXISTS "Public notebook notes are readable by anyone" ON public.notes;

-- Note: Public users can still:
-- 1. View public notebooks (via "Public notebooks are readable by anyone" policy)
-- 2. Chat with public notebooks (via chat history policies)
-- 3. But CANNOT view sources or notes (same as reader role)


