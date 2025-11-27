-- ============================================================================
-- Add user_id column to n8n_chat_histories table
-- This allows chat history to be per-user instead of shared
-- ============================================================================

-- Add user_id column (nullable for backward compatibility and public notebooks)
ALTER TABLE public.n8n_chat_histories
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_user_id ON public.n8n_chat_histories(user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_session_user ON public.n8n_chat_histories(session_id, user_id);

-- Update RLS policies to filter by user_id
-- Users can only view their own chat histories (or from accessible notebooks if user_id is null for backward compatibility)
DROP POLICY IF EXISTS "Users can view chat histories from accessible notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can view chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR SELECT
    USING (
        public.can_access_notebook(session_id::uuid)
        AND (
            user_id = auth.uid() 
            OR user_id IS NULL  -- For backward compatibility with old messages
        )
    );

-- Users can only create chat histories with their own user_id
DROP POLICY IF EXISTS "Users can create chat histories in accessible notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can create chat histories in accessible notebooks"
    ON public.n8n_chat_histories FOR INSERT
    WITH CHECK (
        public.can_access_notebook(session_id::uuid)
        AND (user_id = auth.uid() OR user_id IS NULL)  -- Allow null for public notebooks
    );

-- Users can only delete their own chat histories
DROP POLICY IF EXISTS "Users can delete chat histories from accessible notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can delete chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR DELETE
    USING (
        public.can_access_notebook(session_id::uuid)
        AND (
            user_id = auth.uid()
            OR user_id IS NULL  -- Allow deletion of old messages without user_id
        )
    );

