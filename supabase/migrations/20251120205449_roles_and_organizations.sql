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

-- Create user_roles_lookup table to break RLS recursion
-- This table stores only user_id and role, with simple RLS policies
-- Functions will query this table instead of profiles to avoid recursion
CREATE TABLE IF NOT EXISTS public.user_roles_lookup (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'reader'
);

-- Drop updated_at column if it exists (from previous migration attempts)
ALTER TABLE public.user_roles_lookup DROP COLUMN IF EXISTS updated_at;

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

-- Indexes for user_roles_lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup_user_id ON public.user_roles_lookup(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup_role ON public.user_roles_lookup(role);

-- ============================================================================
-- ROLE LOOKUP TABLE SYNC FUNCTION
-- ============================================================================

-- Function to sync user_roles_lookup table from profiles
-- This keeps the lookup table in sync automatically
-- Uses SECURITY DEFINER to bypass RLS when inserting/updating/deleting
CREATE OR REPLACE FUNCTION public.sync_user_role_lookup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Insert or update in user_roles_lookup
        -- SECURITY DEFINER should bypass RLS, but we handle errors gracefully
        BEGIN
            INSERT INTO public.user_roles_lookup (user_id, role)
            VALUES (NEW.id, COALESCE(NEW.role, 'reader'::user_role))
            ON CONFLICT (user_id) 
            DO UPDATE SET role = EXCLUDED.role;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the transaction
                -- This ensures user creation doesn't fail if lookup table has issues
                RAISE WARNING 'Error syncing user_roles_lookup for user %: %', NEW.id, SQLERRM;
        END;
    ELSIF (TG_OP = 'DELETE') THEN
        BEGIN
            DELETE FROM public.user_roles_lookup WHERE user_id = OLD.id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Error deleting from user_roles_lookup for user %: %', OLD.id, SQLERRM;
        END;
    END IF;
    RETURN NULL;
END;
$$;

-- Create trigger to maintain user_roles_lookup table
DROP TRIGGER IF EXISTS trigger_sync_user_role_lookup ON public.profiles;
CREATE TRIGGER trigger_sync_user_role_lookup
    AFTER INSERT OR UPDATE OF role OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_lookup();

-- Populate the lookup table with existing data
INSERT INTO public.user_roles_lookup (user_id, role)
SELECT id, COALESCE(role, 'reader'::user_role) FROM public.profiles
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user is superadministrator
-- Uses user_roles_lookup table instead of profiles to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_superadministrator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles_lookup
        WHERE user_id = auth.uid() 
        AND role = 'superadministrator'
    );
$$;

-- Function to check if user is administrator
-- Uses user_roles_lookup table instead of profiles to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_administrator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles_lookup
        WHERE user_id = auth.uid() 
        AND role = 'administrator'
    );
$$;

-- Function to check if user is reader
-- Uses user_roles_lookup table instead of profiles to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_reader()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles_lookup
        WHERE user_id = auth.uid() 
        AND role = 'reader'
    );
$$;

-- Function to get user's organization_id
-- Uses SECURITY DEFINER and SET search_path to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid();
$$;

-- Function to check if user can access a notebook (for use in sources, notes, etc.)
-- NOTE: This function should NOT be used in notebooks RLS policies to avoid recursion
CREATE OR REPLACE FUNCTION public.can_access_notebook(notebook_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_user_id uuid;
    user_role_val text;
    user_org_id uuid;
BEGIN
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Get user role and organization
    SELECT role, organization_id INTO user_role_val, user_org_id
    FROM public.profiles
    WHERE id = current_user_id;

    -- Superadministrator can access all notebooks
    IF user_role_val = 'superadministrator' THEN
        RETURN true;
    END IF;

    -- Check if user owns the notebook (directly check without using notebooks table in policy context)
    -- This is safe because we're checking ownership by user_id
    IF EXISTS (
        SELECT 1 
        FROM public.notebooks 
        WHERE id = notebook_id_param 
        AND user_id = current_user_id
    ) THEN
        RETURN true;
    END IF;

    -- Administrator can access notebooks from their organization
    IF user_role_val = 'administrator' AND user_org_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 
            FROM public.notebooks 
            WHERE id = notebook_id_param 
            AND organization_id = user_org_id
        ) THEN
            RETURN true;
        END IF;
    END IF;

    -- Reader can access assigned notebooks
    IF user_role_val = 'reader' THEN
        IF EXISTS (
            SELECT 1 
            FROM public.notebook_assignments 
            WHERE notebook_id = notebook_id_param 
            AND user_id = current_user_id
        ) THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
END;
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

-- Function to prevent users from changing their own role or organization_id
CREATE OR REPLACE FUNCTION public.prevent_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only apply this check if the user is updating their own profile
    IF auth.uid() = new.id THEN
        -- Prevent users from changing their own role
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            RAISE EXCEPTION 'No puedes cambiar tu propio rol. Contacta a un administrador.';
        END IF;
        
        -- Prevent users from changing their own organization_id
        IF OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
            RAISE EXCEPTION 'No puedes cambiar tu propia organización. Contacta a un administrador.';
        END IF;
    END IF;
    
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

-- Trigger to prevent users from changing their own role or organization_id
DROP TRIGGER IF EXISTS prevent_user_role_change ON public.profiles;
CREATE TRIGGER prevent_user_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_user_role_change();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles_lookup ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USER ROLES LOOKUP POLICIES
-- ============================================================================

-- Simple policy: Users can only read their own role from the lookup table
-- This breaks the recursion because checking your own role doesn't require
-- checking your role first - it's a direct comparison
DROP POLICY IF EXISTS "Users can read own role lookup" ON public.user_roles_lookup;
CREATE POLICY "Users can read own role lookup"
    ON public.user_roles_lookup FOR SELECT
    USING (user_id = auth.uid());

-- Allow the sync trigger (SECURITY DEFINER) to manage the lookup table
-- The trigger function has SECURITY DEFINER, which should bypass RLS,
-- but we add policies to ensure inserts/updates/deletes work correctly
-- Note: SECURITY DEFINER functions should bypass RLS, but we add these as safety

-- Policy for service_role (used by Supabase admin operations)
DROP POLICY IF EXISTS "Service role can manage role lookup" ON public.user_roles_lookup;
CREATE POLICY "Service role can manage role lookup"
    ON public.user_roles_lookup FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy to allow the sync function to insert/update/delete
-- CRITICAL: These policies allow the trigger to manage the lookup table
-- The SELECT policy above restricts reads to own user_id for security
DROP POLICY IF EXISTS "Sync function can manage role lookup" ON public.user_roles_lookup;
DROP POLICY IF EXISTS "Allow role lookup management" ON public.user_roles_lookup;
DROP POLICY IF EXISTS "Allow role lookup updates" ON public.user_roles_lookup;
DROP POLICY IF EXISTS "Allow role lookup deletes" ON public.user_roles_lookup;

-- Allow inserts (needed for trigger when creating new users)
CREATE POLICY "Allow role lookup inserts"
    ON public.user_roles_lookup FOR INSERT
    WITH CHECK (true);
    
-- Allow updates (needed for trigger when updating user roles)
CREATE POLICY "Allow role lookup updates"
    ON public.user_roles_lookup FOR UPDATE
    USING (true)
    WITH CHECK (true);
    
-- Allow deletes (needed for trigger when deleting users)
CREATE POLICY "Allow role lookup deletes"
    ON public.user_roles_lookup FOR DELETE
    USING (true);

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
-- FINAL SOLUTION: We use the function is_superadministrator() which has SECURITY DEFINER
-- and should bypass RLS. However, if this still causes recursion, we need to ensure
-- the function truly bypasses RLS. The function is configured to run as postgres
-- (superuser) which should bypass RLS completely.
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
-- IMPORTANT: We cannot use is_superadministrator() here to avoid recursion
DROP POLICY IF EXISTS "Superadministrator can update all profiles" ON public.profiles;
CREATE POLICY "Superadministrator can update all profiles"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 
            FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND p.role = 'superadministrator'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND p.role = 'superadministrator'
        )
    );

-- Users can update their own profile (role and organization_id restrictions handled by trigger)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- UPDATE EXISTING NOTEBOOKS POLICIES
-- ============================================================================

-- Drop ALL existing policies on notebooks to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can create their own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can update their own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can delete their own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Superadministrator can view all notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Superadministrator can create notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Superadministrator can update all notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Superadministrator can delete all notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Administrators can view organization notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Administrators can update organization notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Administrators can delete organization notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Readers can view assigned notebooks" ON public.notebooks;

-- Superadministrator can view all notebooks
-- IMPORTANT: We cannot use is_superadministrator() here because it causes recursion
-- when the function queries profiles and profiles policy also queries profiles.
-- Instead, we check the role directly in a way that doesn't cause recursion.
DROP POLICY IF EXISTS "Superadministrator can view all notebooks" ON public.notebooks;
CREATE POLICY "Superadministrator can view all notebooks"
    ON public.notebooks FOR SELECT
    USING (
        -- Check if current user is superadministrator by querying their own profile
        -- This should not cause recursion because we're checking auth.uid() = id
        -- which is a direct comparison that doesn't trigger RLS recursion
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'superadministrator'
        )
    );

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
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'administrator'
            AND organization_id IS NOT NULL
        )
        AND organization_id IS NOT NULL
        AND organization_id = (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Readers can view assigned notebooks
DROP POLICY IF EXISTS "Readers can view assigned notebooks" ON public.notebooks;
CREATE POLICY "Readers can view assigned notebooks"
    ON public.notebooks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'reader'
        )
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
            -- Superadministrator
            EXISTS (
                SELECT 1 
                FROM public.profiles 
                WHERE id = auth.uid() 
                AND role = 'superadministrator'
            )
            OR 
            -- Regular user (no organization)
            organization_id IS NULL
            OR
            -- Administrator creating for their organization
            (
                EXISTS (
                    SELECT 1 
                    FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role = 'administrator'
                    AND organization_id IS NOT NULL
                )
                AND organization_id = (
                    SELECT organization_id 
                    FROM public.profiles 
                    WHERE id = auth.uid()
                )
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
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'administrator'
            AND organization_id IS NOT NULL
        )
        AND organization_id IS NOT NULL
        AND organization_id = (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'administrator'
            AND organization_id IS NOT NULL
        )
        AND organization_id IS NOT NULL
        AND organization_id = (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
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
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'administrator'
            AND organization_id IS NOT NULL
        )
        AND organization_id IS NOT NULL
        AND organization_id = (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
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

-- Superadministrator can view all sources
DROP POLICY IF EXISTS "Superadministrator can view all sources" ON public.sources;
CREATE POLICY "Superadministrator can view all sources"
    ON public.sources FOR SELECT
    USING (public.is_superadministrator());

-- Users (non-readers) can view sources from accessible notebooks
DROP POLICY IF EXISTS "Users can view sources from accessible notebooks" ON public.sources;
CREATE POLICY "Users can view sources from accessible notebooks"
    ON public.sources FOR SELECT
    USING (
        public.can_access_notebook(notebook_id)
        AND NOT public.is_reader()
    );

-- Superadministrator can manage all sources
DROP POLICY IF EXISTS "Superadministrator can manage all sources" ON public.sources;
CREATE POLICY "Superadministrator can manage all sources"
    ON public.sources FOR ALL
    USING (public.is_superadministrator())
    WITH CHECK (public.is_superadministrator());

-- Users (non-readers) can create sources in accessible notebooks
DROP POLICY IF EXISTS "Users can create sources in accessible notebooks" ON public.sources;
CREATE POLICY "Users can create sources in accessible notebooks"
    ON public.sources FOR INSERT
    WITH CHECK (
        public.can_access_notebook(notebook_id)
        AND NOT public.is_reader()
    );

-- Users (non-readers) can update sources in accessible notebooks
DROP POLICY IF EXISTS "Users can update sources in accessible notebooks" ON public.sources;
CREATE POLICY "Users can update sources in accessible notebooks"
    ON public.sources FOR UPDATE
    USING (
        public.can_access_notebook(notebook_id)
        AND NOT public.is_reader()
    )
    WITH CHECK (
        public.can_access_notebook(notebook_id)
        AND NOT public.is_reader()
    );

-- Users (non-readers) can delete sources from accessible notebooks
DROP POLICY IF EXISTS "Users can delete sources from accessible notebooks" ON public.sources;
CREATE POLICY "Users can delete sources from accessible notebooks"
    ON public.sources FOR DELETE
    USING (
        public.can_access_notebook(notebook_id)
        AND NOT public.is_reader()
    );

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

-- Add new tables to realtime publication (if not already added)
DO $$
BEGIN
    -- Add organizations to realtime publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'organizations'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
    END IF;

    -- Add notebook_assignments to realtime publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notebook_assignments'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notebook_assignments;
    END IF;
END $$;

