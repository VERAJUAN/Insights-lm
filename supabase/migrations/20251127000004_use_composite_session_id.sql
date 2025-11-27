-- ============================================================================
-- Change to composite session_id (notebook_id_user_id) as TEXT
-- This allows n8n Postgres Chat Memory node to filter by user automatically
-- ============================================================================

-- Step 1: Add temporary column for the composite session_id
ALTER TABLE public.n8n_chat_histories
ADD COLUMN IF NOT EXISTS session_id_text text;

-- Step 2: Create composite session_id for existing records
-- Format: notebook_id_user_id (if user_id exists) or just notebook_id (if user_id is null)
UPDATE public.n8n_chat_histories
SET session_id_text = CASE
    WHEN user_id IS NOT NULL THEN session_id::text || '_' || user_id::text
    ELSE session_id::text
END
WHERE session_id_text IS NULL;

-- Step 3: Drop ALL policies that depend on session_id (must be done before dropping column)
DROP POLICY IF EXISTS "Public notebook chat history is readable by anyone" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Public can insert chat messages for public notebooks" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Superadministrator can view all chat histories" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Superadministrator can manage all chat histories" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can view chat histories from accessible notebooks" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can create chat histories in accessible notebooks" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can delete chat histories from accessible notebooks" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can view chat histories from their notebooks" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can create chat histories in their notebooks" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can delete chat histories from their notebooks" ON public.n8n_chat_histories;

-- Step 4: Drop old indexes that use session_id
DROP INDEX IF EXISTS idx_chat_histories_session_id;
DROP INDEX IF EXISTS idx_n8n_chat_histories_session_user;

-- Step 5: Drop the old UUID column (now safe since policies are dropped)
ALTER TABLE public.n8n_chat_histories
DROP COLUMN IF EXISTS session_id;

-- Step 6: Rename the new column
ALTER TABLE public.n8n_chat_histories
RENAME COLUMN session_id_text TO session_id;

-- Step 7: Make session_id NOT NULL
ALTER TABLE public.n8n_chat_histories
ALTER COLUMN session_id SET NOT NULL;

-- Step 8: Drop user_id column (no longer needed, it's in session_id)
ALTER TABLE public.n8n_chat_histories
DROP COLUMN IF EXISTS user_id;

-- Step 9: Create new index on session_id (now TEXT)
CREATE INDEX IF NOT EXISTS idx_chat_histories_session_id ON public.n8n_chat_histories(session_id);

-- Step 10: Function to extract notebook_id from composite session_id
CREATE OR REPLACE FUNCTION public.extract_notebook_id_from_session(session_id_param text)
RETURNS uuid AS $$
DECLARE
  notebook_id_text text;
BEGIN
  -- If session_id contains underscore, extract the part before it
  IF position('_' in session_id_param) > 0 THEN
    notebook_id_text := substring(session_id_param from 1 for position('_' in session_id_param) - 1);
  ELSE
    -- If no underscore, the whole string is the notebook_id (backward compatibility)
    notebook_id_text := session_id_param;
  END IF;
  
  -- Try to convert to UUID
  BEGIN
    RETURN notebook_id_text::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 11: Function to extract user_id from composite session_id
CREATE OR REPLACE FUNCTION public.extract_user_id_from_session(session_id_param text)
RETURNS uuid AS $$
DECLARE
  user_id_text text;
BEGIN
  -- If session_id contains underscore, extract the part after it
  IF position('_' in session_id_param) > 0 THEN
    user_id_text := substring(session_id_param from position('_' in session_id_param) + 1);
    
    -- Try to convert to UUID
    BEGIN
      RETURN user_id_text::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN NULL;
    END;
  END IF;
  
  -- If no underscore, there's no user_id (backward compatibility or public notebook)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 12: Recreate RLS policies with the new composite session_id structure

-- Superadministrator can view all chat histories
CREATE POLICY "Superadministrator can view all chat histories"
    ON public.n8n_chat_histories FOR SELECT
    USING (public.is_superadministrator());

-- Superadministrator can manage all chat histories
CREATE POLICY "Superadministrator can manage all chat histories"
    ON public.n8n_chat_histories FOR ALL
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Users can view chat histories from accessible notebooks
CREATE POLICY "Users can view chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR SELECT
    USING (
        public.can_access_notebook(public.extract_notebook_id_from_session(session_id))
        AND (
            public.extract_user_id_from_session(session_id) = auth.uid()
            OR public.extract_user_id_from_session(session_id) IS NULL  -- For backward compatibility
        )
    );

-- Users can create chat histories in accessible notebooks
CREATE POLICY "Users can create chat histories in accessible notebooks"
    ON public.n8n_chat_histories FOR INSERT
    WITH CHECK (
        public.can_access_notebook(public.extract_notebook_id_from_session(session_id))
        AND (
            public.extract_user_id_from_session(session_id) = auth.uid()
            OR public.extract_user_id_from_session(session_id) IS NULL  -- Allow null for public notebooks
        )
    );

-- Users can delete chat histories from accessible notebooks
CREATE POLICY "Users can delete chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR DELETE
    USING (
        public.can_access_notebook(public.extract_notebook_id_from_session(session_id))
        AND (
            public.extract_user_id_from_session(session_id) = auth.uid()
            OR public.extract_user_id_from_session(session_id) IS NULL  -- For backward compatibility
        )
    );

-- Public notebook chat history is readable by anyone
CREATE POLICY "Public notebook chat history is readable by anyone"
    ON public.n8n_chat_histories FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks
            WHERE notebooks.id = public.extract_notebook_id_from_session(session_id)
            AND notebooks.is_public = true
        )
        AND public.extract_user_id_from_session(session_id) IS NULL  -- Only public messages (no user_id)
    );

-- Public can insert chat messages for public notebooks
CREATE POLICY "Public can insert chat messages for public notebooks"
    ON public.n8n_chat_histories FOR INSERT
    TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.notebooks
            WHERE notebooks.id = public.extract_notebook_id_from_session(session_id)
            AND notebooks.is_public = true
        )
        AND public.extract_user_id_from_session(session_id) IS NULL  -- Public messages have no user_id
    );

