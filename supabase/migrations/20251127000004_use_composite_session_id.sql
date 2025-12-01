-- ============================================================================
-- Composite session_id: Change session_id to TEXT format (notebook_id_user_id)
-- This allows per-user chat history for authenticated users
-- and per-browser history for public notebooks (guest users)
-- ============================================================================
-- Format: 
--   - Authenticated users: "notebook_id_user_id" (UUID_UUID)
--   - Guest users (public notebooks): "notebook_id_guest_browserId" (UUID_guest_UUID)
--   - Backward compatibility: "notebook_id" (just UUID, no user)

-- Step 1: Drop ALL policies that depend on session_id (must be done before changing column)
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

-- Step 2: Add temporary column for the composite session_id
ALTER TABLE public.n8n_chat_histories
ADD COLUMN IF NOT EXISTS session_id_text text;

-- Step 3: Migrate existing data to composite format
-- For existing records: just copy session_id as text (no user_id suffix for backward compatibility)
UPDATE public.n8n_chat_histories
SET session_id_text = session_id::text
WHERE session_id_text IS NULL;

-- Step 4: Drop old indexes that use session_id
DROP INDEX IF EXISTS idx_chat_histories_session_id;
DROP INDEX IF EXISTS idx_n8n_chat_histories_session_user;
DROP INDEX IF EXISTS idx_n8n_chat_histories_user_id;

-- Step 5: Drop the old UUID column (now safe since policies are dropped)
ALTER TABLE public.n8n_chat_histories
DROP COLUMN IF EXISTS session_id;

-- Step 6: Rename the new column
ALTER TABLE public.n8n_chat_histories
RENAME COLUMN session_id_text TO session_id;

-- Step 7: Make session_id NOT NULL
ALTER TABLE public.n8n_chat_histories
ALTER COLUMN session_id SET NOT NULL;

-- Step 8: Drop user_id column if it exists (no longer needed, it's in session_id)
ALTER TABLE public.n8n_chat_histories
DROP COLUMN IF EXISTS user_id;

-- Step 9: Create new index on session_id (now TEXT)
CREATE INDEX IF NOT EXISTS idx_chat_histories_session_id ON public.n8n_chat_histories(session_id);

-- Step 10: Function to extract notebook_id from composite session_id
DROP FUNCTION IF EXISTS public.extract_notebook_id_from_session(text);
CREATE FUNCTION public.extract_notebook_id_from_session(session_id_param text)
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
-- Returns text (not uuid) to support both UUIDs and browser_ids (guest_*)
DROP FUNCTION IF EXISTS public.extract_user_id_from_session(text);
CREATE FUNCTION public.extract_user_id_from_session(session_id_param text)
RETURNS text AS $$
DECLARE
  user_id_text text;
BEGIN
  -- If session_id contains underscore, extract the part after it
  IF position('_' in session_id_param) > 0 THEN
    user_id_text := substring(session_id_param from position('_' in session_id_param) + 1);
    RETURN user_id_text;
  END IF;
  
  -- If no underscore, there's no user_id (backward compatibility or public notebook)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 12: Function to extract user_id as UUID (for authenticated users only)
DROP FUNCTION IF EXISTS public.extract_user_id_uuid_from_session(text);
CREATE FUNCTION public.extract_user_id_uuid_from_session(session_id_param text)
RETURNS uuid AS $$
DECLARE
  user_id_text text;
BEGIN
  user_id_text := public.extract_user_id_from_session(session_id_param);
  
  -- If user_id_text is NULL or starts with 'guest_', return NULL
  IF user_id_text IS NULL OR user_id_text LIKE 'guest_%' THEN
    RETURN NULL;
  END IF;
  
  -- Try to convert to UUID
  BEGIN
    RETURN user_id_text::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 13: Function to check if user_id is a browser_id (guest user)
DROP FUNCTION IF EXISTS public.is_browser_id(text);
CREATE FUNCTION public.is_browser_id(user_id_param text)
RETURNS boolean AS $$
BEGIN
  -- Browser IDs start with "guest_"
  RETURN user_id_param IS NOT NULL AND user_id_param LIKE 'guest_%';
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 14: Recreate RLS policies with the new composite session_id structure

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
-- Only their own messages (by user_id) or messages without user_id (backward compatibility)
CREATE POLICY "Users can view chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR SELECT
    USING (
        public.can_access_notebook(public.extract_notebook_id_from_session(session_id))
        AND (
            -- User can only see their own messages
            public.extract_user_id_uuid_from_session(session_id) = auth.uid()
            -- Or messages without user_id (backward compatibility)
            OR public.extract_user_id_from_session(session_id) IS NULL
        )
    );

-- Users can create chat histories in accessible notebooks
-- Only with their own user_id
CREATE POLICY "Users can create chat histories in accessible notebooks"
    ON public.n8n_chat_histories FOR INSERT
    WITH CHECK (
        public.can_access_notebook(public.extract_notebook_id_from_session(session_id))
        AND (
            -- User can only create messages with their own user_id
            public.extract_user_id_uuid_from_session(session_id) = auth.uid()
            -- Or without user_id (for backward compatibility, but not recommended)
            OR public.extract_user_id_from_session(session_id) IS NULL
        )
    );

-- Users can delete chat histories from accessible notebooks
-- Only their own messages
CREATE POLICY "Users can delete chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR DELETE
    USING (
        public.can_access_notebook(public.extract_notebook_id_from_session(session_id))
        AND (
            -- User can only delete their own messages
            public.extract_user_id_uuid_from_session(session_id) = auth.uid()
            -- Or messages without user_id (backward compatibility)
            OR public.extract_user_id_from_session(session_id) IS NULL
        )
    );

-- Public notebook chat history: readable by anyone for public notebooks
-- Supports both authenticated users and browser-based sessions (guest_*)
CREATE POLICY "Public notebook chat history is readable by anyone"
    ON public.n8n_chat_histories FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks
            WHERE notebooks.id = public.extract_notebook_id_from_session(session_id)
            AND notebooks.is_public = true
        )
        AND (
            -- Allow messages with browser_id (guest users) - anyone can read
            public.is_browser_id(public.extract_user_id_from_session(session_id))
            -- Or messages with authenticated user_id (if user is logged in, they see their own)
            OR (auth.uid() IS NOT NULL AND public.extract_user_id_uuid_from_session(session_id) = auth.uid())
            -- Or messages without user_id (backward compatibility)
            OR public.extract_user_id_from_session(session_id) IS NULL
        )
    );

-- Public can insert chat messages for public notebooks
-- Supports both authenticated users and browser-based sessions (guest_*)
CREATE POLICY "Public can insert chat messages for public notebooks"
    ON public.n8n_chat_histories FOR INSERT
    TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.notebooks
            WHERE notebooks.id = public.extract_notebook_id_from_session(session_id)
            AND notebooks.is_public = true
        )
        AND (
            -- Allow messages with browser_id (guest users)
            public.is_browser_id(public.extract_user_id_from_session(session_id))
            -- Or messages with authenticated user_id (if user is logged in)
            OR (auth.uid() IS NOT NULL AND public.extract_user_id_uuid_from_session(session_id) = auth.uid())
            -- Or messages without user_id (backward compatibility)
            OR public.extract_user_id_from_session(session_id) IS NULL
        )
    );
