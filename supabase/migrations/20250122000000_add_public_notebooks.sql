-- ============================================================================
-- MIGRATION: Add Public Notebooks Support
-- ============================================================================
-- This migration adds support for public notebooks that can be accessed
-- by anyone with the link, without authentication.

-- Add columns to notebooks table
ALTER TABLE public.notebooks 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS public_slug text;

-- Create unique index on public_slug for public notebooks
CREATE UNIQUE INDEX IF NOT EXISTS notebooks_public_slug_unique_idx 
ON public.notebooks(public_slug) 
WHERE is_public = true AND public_slug IS NOT NULL;

-- Function to generate a unique public slug
CREATE OR REPLACE FUNCTION public.generate_public_slug()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    new_slug text;
    slug_exists boolean;
BEGIN
    LOOP
        -- Generate a random 12-character slug
        new_slug := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
        
        -- Check if slug already exists
        SELECT EXISTS(
            SELECT 1 FROM public.notebooks 
            WHERE public_slug = new_slug AND is_public = true
        ) INTO slug_exists;
        
        -- Exit loop if slug is unique
        EXIT WHEN NOT slug_exists;
    END LOOP;
    
    RETURN new_slug;
END;
$$;

-- Trigger function to generate public_slug when notebook is made public
CREATE OR REPLACE FUNCTION public.handle_public_notebook_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If notebook is being made public and doesn't have a slug, generate one
    IF NEW.is_public = true AND (NEW.public_slug IS NULL OR NEW.public_slug = '') THEN
        NEW.public_slug := public.generate_public_slug();
    END IF;
    
    -- If notebook is being made private, clear the slug
    IF NEW.is_public = false THEN
        NEW.public_slug := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_handle_public_notebook_slug ON public.notebooks;
CREATE TRIGGER trigger_handle_public_notebook_slug
    BEFORE INSERT OR UPDATE OF is_public, public_slug ON public.notebooks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_public_notebook_slug();

-- ============================================================================
-- RLS POLICIES FOR PUBLIC NOTEBOOKS
-- ============================================================================

-- Allow public read access to notebooks marked as public
DROP POLICY IF EXISTS "Public notebooks are readable by anyone" ON public.notebooks;
CREATE POLICY "Public notebooks are readable by anyone"
ON public.notebooks
FOR SELECT
TO public
USING (is_public = true);

-- Allow public read access to sources of public notebooks
DROP POLICY IF EXISTS "Public notebook sources are readable by anyone" ON public.sources;
CREATE POLICY "Public notebook sources are readable by anyone"
ON public.sources
FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1 FROM public.notebooks
        WHERE notebooks.id = sources.notebook_id
        AND notebooks.is_public = true
    )
);

-- Allow public read access to notes of public notebooks
DROP POLICY IF EXISTS "Public notebook notes are readable by anyone" ON public.notes;
CREATE POLICY "Public notebook notes are readable by anyone"
ON public.notes
FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1 FROM public.notebooks
        WHERE notebooks.id = notes.notebook_id
        AND notebooks.is_public = true
    )
);

-- Allow public read access to chat history of public notebooks
DROP POLICY IF EXISTS "Public notebook chat history is readable by anyone" ON public.n8n_chat_histories;
CREATE POLICY "Public notebook chat history is readable by anyone"
ON public.n8n_chat_histories
FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1 FROM public.notebooks
        WHERE notebooks.id::text = n8n_chat_histories.session_id::text
        AND notebooks.is_public = true
    )
);

-- Allow public to insert chat messages for public notebooks
DROP POLICY IF EXISTS "Public can insert chat messages for public notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Public can insert chat messages for public notebooks"
ON public.n8n_chat_histories
FOR INSERT
TO public
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.notebooks
        WHERE notebooks.id::text = n8n_chat_histories.session_id::text
        AND notebooks.is_public = true
    )
);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Ensure public notebooks cannot be assigned to readers
-- (This is enforced at the application level, but we add a check constraint)
-- Note: We'll handle this in the application logic since notebook_assignments
-- requires authentication anyway

-- Add comment
COMMENT ON COLUMN public.notebooks.is_public IS 'If true, the notebook is publicly accessible via public_slug';
COMMENT ON COLUMN public.notebooks.public_slug IS 'Unique slug for public access. Only set when is_public is true';

