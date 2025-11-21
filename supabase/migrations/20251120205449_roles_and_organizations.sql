-- ============================================================================
-- MIGRATION: Sistema de Roles y Organizaciones
-- ============================================================================
-- Esta migración agrega:
-- 1. Sistema de roles (superadministrator, administrator, reader)
-- 2. Tabla de organizaciones
-- 3. Asignación de cuadernos a lectores
-- 4. Prompts personalizados por organización
-- 5. Políticas RLS actualizadas para roles
-- ============================================================================

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- Create enum for user roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('superadministrator', 'administrator', 'reader');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    custom_prompt text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create notebook_assignments table (for readers)
CREATE TABLE IF NOT EXISTS public.notebook_assignments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(notebook_id, user_id)
);

-- ============================================================================
-- MODIFY EXISTING TABLES
-- ============================================================================

-- Add role and organization_id to profiles
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'reader',
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Add organization_id to notebooks
ALTER TABLE public.notebooks 
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for organizations
CREATE INDEX IF NOT EXISTS idx_organizations_name ON public.organizations(name);

-- Indexes for notebook_assignments
CREATE INDEX IF NOT EXISTS idx_notebook_assignments_notebook_id ON public.notebook_assignments(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_assignments_user_id ON public.notebook_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_assignments_user_notebook ON public.notebook_assignments(user_id, notebook_id);

-- Indexes for profiles (role and organization)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- Indexes for notebooks (organization)
CREATE INDEX IF NOT EXISTS idx_notebooks_organization_id ON public.notebooks(organization_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user is superadministrator
CREATE OR REPLACE FUNCTION public.is_superadministrator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'superadministrator'
    );
$$;

-- Function to check if user is administrator
CREATE OR REPLACE FUNCTION public.is_administrator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'administrator'
    );
$$;

-- Function to check if user is reader
CREATE OR REPLACE FUNCTION public.is_reader()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'reader'
    );
$$;

-- Function to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid();
$$;

-- Function to check if user can access a notebook
CREATE OR REPLACE FUNCTION public.can_access_notebook(notebook_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT 
        -- Superadministrator can access all notebooks
        public.is_superadministrator()
        OR
        -- User owns the notebook
        EXISTS (
            SELECT 1 
            FROM public.notebooks 
            WHERE id = notebook_id_param 
            AND user_id = auth.uid()
        )
        OR
        -- Administrator can access notebooks from their organization
        (
            public.is_administrator()
            AND EXISTS (
                SELECT 1 
                FROM public.notebooks n
                INNER JOIN public.profiles p ON n.organization_id = p.organization_id
                WHERE n.id = notebook_id_param 
                AND p.id = auth.uid()
            )
        )
        OR
        -- Reader can access assigned notebooks
        (
            public.is_reader()
            AND EXISTS (
                SELECT 1 
                FROM public.notebook_assignments 
                WHERE notebook_id = notebook_id_param 
                AND user_id = auth.uid()
            )
        );
$$;

-- Function to check if user belongs to same organization as notebook
CREATE OR REPLACE FUNCTION public.same_organization_as_notebook(notebook_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.notebooks n
        INNER JOIN public.profiles p ON n.organization_id = p.organization_id
        WHERE n.id = notebook_id_param 
        AND p.id = auth.uid()
        AND n.organization_id IS NOT NULL
    );
$$;

-- Function to count notebooks for administrator
CREATE OR REPLACE FUNCTION public.count_administrator_notebooks()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT COUNT(*)::integer
    FROM public.notebooks
    WHERE user_id = auth.uid()
    AND EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'administrator'
    );
$$;

-- Function to update updated_at timestamp for organizations
CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    new.updated_at = timezone('utc'::text, now());
    RETURN new;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for organizations updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_organizations_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

-- Superadministrator can view all organizations
DROP POLICY IF EXISTS "Superadministrator can view all organizations" ON public.organizations;
CREATE POLICY "Superadministrator can view all organizations"
    ON public.organizations FOR SELECT
    USING (public.is_superadministrator());

-- Administrators can view their own organization
DROP POLICY IF EXISTS "Administrators can view their organization" ON public.organizations;
CREATE POLICY "Administrators can view their organization"
    ON public.organizations FOR SELECT
    USING (
        public.is_administrator()
        AND id = public.get_user_organization_id()
    );

-- Readers can view their organization
DROP POLICY IF EXISTS "Readers can view their organization" ON public.organizations;
CREATE POLICY "Readers can view their organization"
    ON public.organizations FOR SELECT
    USING (
        public.is_reader()
        AND id = public.get_user_organization_id()
    );

-- Superadministrator can manage all organizations
DROP POLICY IF EXISTS "Superadministrator can manage organizations" ON public.organizations;
CREATE POLICY "Superadministrator can manage organizations"
    ON public.organizations FOR ALL
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Administrators can update their organization's prompt
DROP POLICY IF EXISTS "Administrators can update their organization prompt" ON public.organizations;
CREATE POLICY "Administrators can update their organization prompt"
    ON public.organizations FOR UPDATE
    USING (
        public.is_administrator()
        AND id = public.get_user_organization_id()
    )
    WITH CHECK (
        public.is_administrator()
        AND id = public.get_user_organization_id()
    );

-- ============================================================================
-- NOTEBOOK_ASSIGNMENTS POLICIES
-- ============================================================================

-- Superadministrator can view all assignments
DROP POLICY IF EXISTS "Superadministrator can view all assignments" ON public.notebook_assignments;
CREATE POLICY "Superadministrator can view all assignments"
    ON public.notebook_assignments FOR SELECT
    USING (public.is_superadministrator());

-- Administrators can view assignments for notebooks in their organization
DROP POLICY IF EXISTS "Administrators can view organization assignments" ON public.notebook_assignments;
CREATE POLICY "Administrators can view organization assignments"
    ON public.notebook_assignments FOR SELECT
    USING (
        public.is_administrator()
        AND EXISTS (
            SELECT 1 
            FROM public.notebooks n
            WHERE n.id = notebook_assignments.notebook_id
            AND n.organization_id = public.get_user_organization_id()
        )
    );

-- Readers can view their own assignments
DROP POLICY IF EXISTS "Readers can view their assignments" ON public.notebook_assignments;
CREATE POLICY "Readers can view their assignments"
    ON public.notebook_assignments FOR SELECT
    USING (
        public.is_reader()
        AND user_id = auth.uid()
    );

-- Superadministrator can manage all assignments
DROP POLICY IF EXISTS "Superadministrator can manage all assignments" ON public.notebook_assignments;
CREATE POLICY "Superadministrator can manage all assignments"
    ON public.notebook_assignments FOR ALL
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Administrators can manage assignments for notebooks in their organization
DROP POLICY IF EXISTS "Administrators can manage organization assignments" ON public.notebook_assignments;
CREATE POLICY "Administrators can manage organization assignments"
    ON public.notebook_assignments FOR ALL
    USING (
        public.is_administrator()
        AND EXISTS (
            SELECT 1 
            FROM public.notebooks n
            WHERE n.id = notebook_assignments.notebook_id
            AND n.organization_id = public.get_user_organization_id()
        )
    )
    WITH CHECK (
        public.is_administrator()
        AND EXISTS (
            SELECT 1 
            FROM public.notebooks n
            WHERE n.id = notebook_assignments.notebook_id
            AND n.organization_id = public.get_user_organization_id()
        )
    );

-- ============================================================================
-- UPDATE EXISTING PROFILES POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Superadministrator can view all profiles
DROP POLICY IF EXISTS "Superadministrator can view all profiles" ON public.profiles;
CREATE POLICY "Superadministrator can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_superadministrator());

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Administrators can view profiles in their organization
DROP POLICY IF EXISTS "Administrators can view organization profiles" ON public.profiles;
CREATE POLICY "Administrators can view organization profiles"
    ON public.profiles FOR SELECT
    USING (
        public.is_administrator()
        AND organization_id = public.get_user_organization_id()
        AND organization_id IS NOT NULL
    );

-- Superadministrator can update all profiles
DROP POLICY IF EXISTS "Superadministrator can update all profiles" ON public.profiles;
CREATE POLICY "Superadministrator can update all profiles"
    ON public.profiles FOR UPDATE
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Users can update their own profile (except role and organization_id)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND (
            -- Users cannot change their own role
            (OLD.role IS NOT DISTINCT FROM NEW.role)
            AND
            -- Users cannot change their own organization_id
            (OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id)
        )
    );

-- ============================================================================
-- UPDATE EXISTING NOTEBOOKS POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can create their own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can update their own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can delete their own notebooks" ON public.notebooks;

-- Superadministrator can view all notebooks
DROP POLICY IF EXISTS "Superadministrator can view all notebooks" ON public.notebooks;
CREATE POLICY "Superadministrator can view all notebooks"
    ON public.notebooks FOR SELECT
    USING (public.is_superadministrator());

-- Users can view their own notebooks
DROP POLICY IF EXISTS "Users can view their own notebooks" ON public.notebooks;
CREATE POLICY "Users can view their own notebooks"
    ON public.notebooks FOR SELECT
    USING (auth.uid() = user_id);

-- Administrators can view notebooks from their organization
DROP POLICY IF EXISTS "Administrators can view organization notebooks" ON public.notebooks;
CREATE POLICY "Administrators can view organization notebooks"
    ON public.notebooks FOR SELECT
    USING (
        public.is_administrator()
        AND organization_id = public.get_user_organization_id()
        AND organization_id IS NOT NULL
    );

-- Readers can view assigned notebooks
DROP POLICY IF EXISTS "Readers can view assigned notebooks" ON public.notebooks;
CREATE POLICY "Readers can view assigned notebooks"
    ON public.notebooks FOR SELECT
    USING (
        public.is_reader()
        AND EXISTS (
            SELECT 1 
            FROM public.notebook_assignments 
            WHERE notebook_id = notebooks.id 
            AND user_id = auth.uid()
        )
    );

-- Superadministrator can create notebooks
DROP POLICY IF EXISTS "Superadministrator can create notebooks" ON public.notebooks;
CREATE POLICY "Superadministrator can create notebooks"
    ON public.notebooks FOR INSERT
    WITH CHECK (public.is_superadministrator());

-- Users can create their own notebooks (with organization check for administrators)
DROP POLICY IF EXISTS "Users can create their own notebooks" ON public.notebooks;
CREATE POLICY "Users can create their own notebooks"
    ON public.notebooks FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Superadministrator or regular user (no organization)
            public.is_superadministrator()
            OR organization_id IS NULL
            OR
            -- Administrator creating for their organization
            (
                public.is_administrator()
                AND organization_id = public.get_user_organization_id()
            )
        )
    );

-- Superadministrator can update all notebooks
DROP POLICY IF EXISTS "Superadministrator can update all notebooks" ON public.notebooks;
CREATE POLICY "Superadministrator can update all notebooks"
    ON public.notebooks FOR UPDATE
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Users can update their own notebooks
DROP POLICY IF EXISTS "Users can update their own notebooks" ON public.notebooks;
CREATE POLICY "Users can update their own notebooks"
    ON public.notebooks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Administrators can update notebooks from their organization
DROP POLICY IF EXISTS "Administrators can update organization notebooks" ON public.notebooks;
CREATE POLICY "Administrators can update organization notebooks"
    ON public.notebooks FOR UPDATE
    USING (
        public.is_administrator()
        AND organization_id = public.get_user_organization_id()
        AND organization_id IS NOT NULL
    )
    WITH CHECK (
        public.is_administrator()
        AND organization_id = public.get_user_organization_id()
        AND organization_id IS NOT NULL
    );

-- Superadministrator can delete all notebooks
DROP POLICY IF EXISTS "Superadministrator can delete all notebooks" ON public.notebooks;
CREATE POLICY "Superadministrator can delete all notebooks"
    ON public.notebooks FOR DELETE
    USING (public.is_superadministrator());

-- Users can delete their own notebooks
DROP POLICY IF EXISTS "Users can delete their own notebooks" ON public.notebooks;
CREATE POLICY "Users can delete their own notebooks"
    ON public.notebooks FOR DELETE
    USING (auth.uid() = user_id);

-- Administrators can delete notebooks from their organization
DROP POLICY IF EXISTS "Administrators can delete organization notebooks" ON public.notebooks;
CREATE POLICY "Administrators can delete organization notebooks"
    ON public.notebooks FOR DELETE
    USING (
        public.is_administrator()
        AND organization_id = public.get_user_organization_id()
        AND organization_id IS NOT NULL
    );

-- ============================================================================
-- UPDATE SOURCES POLICIES (to respect notebook access)
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view sources from their notebooks" ON public.sources;
DROP POLICY IF EXISTS "Users can create sources in their notebooks" ON public.sources;
DROP POLICY IF EXISTS "Users can update sources in their notebooks" ON public.sources;
DROP POLICY IF EXISTS "Users can delete sources from their notebooks" ON public.sources;

-- Superadministrator can view all sources
DROP POLICY IF EXISTS "Superadministrator can view all sources" ON public.sources;
CREATE POLICY "Superadministrator can view all sources"
    ON public.sources FOR SELECT
    USING (public.is_superadministrator());

-- Users can view sources from accessible notebooks
DROP POLICY IF EXISTS "Users can view sources from accessible notebooks" ON public.sources;
CREATE POLICY "Users can view sources from accessible notebooks"
    ON public.sources FOR SELECT
    USING (public.can_access_notebook(notebook_id));

-- Superadministrator can manage all sources
DROP POLICY IF EXISTS "Superadministrator can manage all sources" ON public.sources;
CREATE POLICY "Superadministrator can manage all sources"
    ON public.sources FOR ALL
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Users can create sources in accessible notebooks
DROP POLICY IF EXISTS "Users can create sources in accessible notebooks" ON public.sources;
CREATE POLICY "Users can create sources in accessible notebooks"
    ON public.sources FOR INSERT
    WITH CHECK (public.can_access_notebook(notebook_id));

-- Users can update sources in accessible notebooks
DROP POLICY IF EXISTS "Users can update sources in accessible notebooks" ON public.sources;
CREATE POLICY "Users can update sources in accessible notebooks"
    ON public.sources FOR UPDATE
    USING (public.can_access_notebook(notebook_id))
    WITH CHECK (public.can_access_notebook(notebook_id));

-- Users can delete sources from accessible notebooks
DROP POLICY IF EXISTS "Users can delete sources from accessible notebooks" ON public.sources;
CREATE POLICY "Users can delete sources from accessible notebooks"
    ON public.sources FOR DELETE
    USING (public.can_access_notebook(notebook_id));

-- ============================================================================
-- UPDATE NOTES POLICIES (to respect notebook access)
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view notes from their notebooks" ON public.notes;
DROP POLICY IF EXISTS "Users can create notes in their notebooks" ON public.notes;
DROP POLICY IF EXISTS "Users can update notes in their notebooks" ON public.notes;
DROP POLICY IF EXISTS "Users can delete notes from their notebooks" ON public.notes;

-- Superadministrator can view all notes
DROP POLICY IF EXISTS "Superadministrator can view all notes" ON public.notes;
CREATE POLICY "Superadministrator can view all notes"
    ON public.notes FOR SELECT
    USING (public.is_superadministrator());

-- Users can view notes from accessible notebooks
DROP POLICY IF EXISTS "Users can view notes from accessible notebooks" ON public.notes;
CREATE POLICY "Users can view notes from accessible notebooks"
    ON public.notes FOR SELECT
    USING (public.can_access_notebook(notebook_id));

-- Superadministrator can manage all notes
DROP POLICY IF EXISTS "Superadministrator can manage all notes" ON public.notes;
CREATE POLICY "Superadministrator can manage all notes"
    ON public.notes FOR ALL
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Users can create notes in accessible notebooks
DROP POLICY IF EXISTS "Users can create notes in accessible notebooks" ON public.notes;
CREATE POLICY "Users can create notes in accessible notebooks"
    ON public.notes FOR INSERT
    WITH CHECK (public.can_access_notebook(notebook_id));

-- Users can update notes in accessible notebooks
DROP POLICY IF EXISTS "Users can update notes in accessible notebooks" ON public.notes;
CREATE POLICY "Users can update notes in accessible notebooks"
    ON public.notes FOR UPDATE
    USING (public.can_access_notebook(notebook_id))
    WITH CHECK (public.can_access_notebook(notebook_id));

-- Users can delete notes from accessible notebooks
DROP POLICY IF EXISTS "Users can delete notes from accessible notebooks" ON public.notes;
CREATE POLICY "Users can delete notes from accessible notebooks"
    ON public.notes FOR DELETE
    USING (public.can_access_notebook(notebook_id));

-- ============================================================================
-- UPDATE DOCUMENTS POLICIES (to respect notebook access)
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view documents from their notebooks" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents in their notebooks" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents in their notebooks" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents from their notebooks" ON public.documents;

-- Superadministrator can view all documents
DROP POLICY IF EXISTS "Superadministrator can view all documents" ON public.documents;
CREATE POLICY "Superadministrator can view all documents"
    ON public.documents FOR SELECT
    USING (public.is_superadministrator());

-- Users can view documents from accessible notebooks
DROP POLICY IF EXISTS "Users can view documents from accessible notebooks" ON public.documents;
CREATE POLICY "Users can view documents from accessible notebooks"
    ON public.documents FOR SELECT
    USING (
        metadata->>'notebook_id' IS NOT NULL
        AND public.can_access_notebook((metadata->>'notebook_id')::uuid)
    );

-- Superadministrator can manage all documents
DROP POLICY IF EXISTS "Superadministrator can manage all documents" ON public.documents;
CREATE POLICY "Superadministrator can manage all documents"
    ON public.documents FOR ALL
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Users can create documents in accessible notebooks
DROP POLICY IF EXISTS "Users can create documents in accessible notebooks" ON public.documents;
CREATE POLICY "Users can create documents in accessible notebooks"
    ON public.documents FOR INSERT
    WITH CHECK (
        metadata->>'notebook_id' IS NOT NULL
        AND public.can_access_notebook((metadata->>'notebook_id')::uuid)
    );

-- Users can update documents in accessible notebooks
DROP POLICY IF EXISTS "Users can update documents in accessible notebooks" ON public.documents;
CREATE POLICY "Users can update documents in accessible notebooks"
    ON public.documents FOR UPDATE
    USING (
        metadata->>'notebook_id' IS NOT NULL
        AND public.can_access_notebook((metadata->>'notebook_id')::uuid)
    )
    WITH CHECK (
        metadata->>'notebook_id' IS NOT NULL
        AND public.can_access_notebook((metadata->>'notebook_id')::uuid)
    );

-- Users can delete documents from accessible notebooks
DROP POLICY IF EXISTS "Users can delete documents from accessible notebooks" ON public.documents;
CREATE POLICY "Users can delete documents from accessible notebooks"
    ON public.documents FOR DELETE
    USING (
        metadata->>'notebook_id' IS NOT NULL
        AND public.can_access_notebook((metadata->>'notebook_id')::uuid)
    );

-- ============================================================================
-- UPDATE CHAT HISTORIES POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view chat histories from their notebooks" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can create chat histories in their notebooks" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can delete chat histories from their notebooks" ON public.n8n_chat_histories;

-- Superadministrator can view all chat histories
DROP POLICY IF EXISTS "Superadministrator can view all chat histories" ON public.n8n_chat_histories;
CREATE POLICY "Superadministrator can view all chat histories"
    ON public.n8n_chat_histories FOR SELECT
    USING (public.is_superadministrator());

-- Users can view chat histories from accessible notebooks
DROP POLICY IF EXISTS "Users can view chat histories from accessible notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can view chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR SELECT
    USING (public.can_access_notebook(session_id::uuid));

-- Superadministrator can manage all chat histories
DROP POLICY IF EXISTS "Superadministrator can manage all chat histories" ON public.n8n_chat_histories;
CREATE POLICY "Superadministrator can manage all chat histories"
    ON public.n8n_chat_histories FOR ALL
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Users can create chat histories in accessible notebooks
DROP POLICY IF EXISTS "Users can create chat histories in accessible notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can create chat histories in accessible notebooks"
    ON public.n8n_chat_histories FOR INSERT
    WITH CHECK (public.can_access_notebook(session_id::uuid));

-- Users can delete chat histories from accessible notebooks
DROP POLICY IF EXISTS "Users can delete chat histories from accessible notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can delete chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR DELETE
    USING (public.can_access_notebook(session_id::uuid));

-- ============================================================================
-- REALTIME CONFIGURATION
-- ============================================================================

-- Enable realtime for new tables
ALTER TABLE public.organizations REPLICA IDENTITY FULL;
ALTER TABLE public.notebook_assignments REPLICA IDENTITY FULL;

-- Add new tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notebook_assignments;

