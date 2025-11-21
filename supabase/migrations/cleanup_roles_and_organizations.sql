-- ============================================================================
-- CLEANUP SCRIPT: Eliminar todo lo relacionado con roles y organizaciones
-- ============================================================================
-- Este script elimina todas las tablas, políticas, funciones y modificaciones
-- relacionadas con el sistema de roles y organizaciones para poder ejecutar
-- las migraciones desde cero.
-- ============================================================================

-- ============================================================================
-- ELIMINAR TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_sync_user_role_lookup ON public.profiles;
DROP TRIGGER IF EXISTS prevent_user_role_change ON public.profiles;

-- ============================================================================
-- ELIMINAR FUNCIONES
-- ============================================================================

DROP FUNCTION IF EXISTS public.sync_user_role_lookup() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_user_role_change() CASCADE;
DROP FUNCTION IF EXISTS public.is_superadministrator() CASCADE;
DROP FUNCTION IF EXISTS public.is_administrator() CASCADE;
DROP FUNCTION IF EXISTS public.is_reader() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_organization_id() CASCADE;
DROP FUNCTION IF EXISTS public.can_access_notebook(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.same_organization_as_notebook(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.count_administrator_notebooks() CASCADE;
DROP FUNCTION IF EXISTS public.get_notebook_count_for_organization(uuid) CASCADE;

-- ============================================================================
-- ELIMINAR POLÍTICAS RLS
-- ============================================================================

-- Políticas de user_roles_lookup (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles_lookup') THEN
        DROP POLICY IF EXISTS "Users can read own role lookup" ON public.user_roles_lookup;
        DROP POLICY IF EXISTS "Service role can manage role lookup" ON public.user_roles_lookup;
        DROP POLICY IF EXISTS "Sync function can manage role lookup" ON public.user_roles_lookup;
    END IF;
END $$;

-- Políticas de organizations (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations') THEN
        DROP POLICY IF EXISTS "Superadministrator can view all organizations" ON public.organizations;
        DROP POLICY IF EXISTS "Administrators can view their organization" ON public.organizations;
        DROP POLICY IF EXISTS "Readers can view their organization" ON public.organizations;
        DROP POLICY IF EXISTS "Superadministrator can manage organizations" ON public.organizations;
    END IF;
END $$;

-- Políticas de notebook_assignments (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notebook_assignments') THEN
        DROP POLICY IF EXISTS "Superadministrator can manage all assignments" ON public.notebook_assignments;
        DROP POLICY IF EXISTS "Administrators can manage assignments for their organization" ON public.notebook_assignments;
        DROP POLICY IF EXISTS "Readers can view their own assignments" ON public.notebook_assignments;
    END IF;
END $$;

-- Políticas de profiles (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        DROP POLICY IF EXISTS "Superadministrator can view all profiles" ON public.profiles;
        DROP POLICY IF EXISTS "Administrators can view organization profiles" ON public.profiles;
        DROP POLICY IF EXISTS "Superadministrator can update all profiles" ON public.profiles;
    END IF;
END $$;

-- Políticas de notebooks (eliminar TODAS las políticas de notebooks primero, solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notebooks') THEN
        DROP POLICY IF EXISTS "Superadministrator can view all notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Superadministrator can create notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Superadministrator can update all notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Superadministrator can delete all notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Administrators can view organization notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Administrators can update organization notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Administrators can delete organization notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Readers can view assigned notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Users can view their own notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Users can create their own notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Users can update their own notebooks" ON public.notebooks;
        DROP POLICY IF EXISTS "Users can delete their own notebooks" ON public.notebooks;
    END IF;
END $$;

-- Políticas de sources (si fueron actualizadas, solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sources') THEN
        DROP POLICY IF EXISTS "Superadministrator can manage all sources" ON public.sources;
        DROP POLICY IF EXISTS "Administrators can manage organization sources" ON public.sources;
        DROP POLICY IF EXISTS "Users can view sources from accessible notebooks" ON public.sources;
        DROP POLICY IF EXISTS "Users can create sources in accessible notebooks" ON public.sources;
        DROP POLICY IF EXISTS "Users can update sources in accessible notebooks" ON public.sources;
        DROP POLICY IF EXISTS "Users can delete sources from accessible notebooks" ON public.sources;
    END IF;
END $$;

-- Políticas de notes (si fueron actualizadas, solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notes') THEN
        DROP POLICY IF EXISTS "Superadministrator can manage all notes" ON public.notes;
        DROP POLICY IF EXISTS "Administrators can manage organization notes" ON public.notes;
        DROP POLICY IF EXISTS "Users can view notes from accessible notebooks" ON public.notes;
        DROP POLICY IF EXISTS "Users can create notes in accessible notebooks" ON public.notes;
        DROP POLICY IF EXISTS "Users can update notes in accessible notebooks" ON public.notes;
        DROP POLICY IF EXISTS "Users can delete notes from accessible notebooks" ON public.notes;
    END IF;
END $$;

-- Políticas de documents (si fueron actualizadas, solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
        DROP POLICY IF EXISTS "Superadministrator can manage all documents" ON public.documents;
        DROP POLICY IF EXISTS "Administrators can manage organization documents" ON public.documents;
        DROP POLICY IF EXISTS "Users can view documents from accessible notebooks" ON public.documents;
        DROP POLICY IF EXISTS "Users can create documents in accessible notebooks" ON public.documents;
        DROP POLICY IF EXISTS "Users can update documents in accessible notebooks" ON public.documents;
        DROP POLICY IF EXISTS "Users can delete documents from accessible notebooks" ON public.documents;
    END IF;
END $$;

-- Políticas de n8n_chat_histories (si fueron actualizadas, solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'n8n_chat_histories') THEN
        DROP POLICY IF EXISTS "Superadministrator can view all chat histories" ON public.n8n_chat_histories;
        DROP POLICY IF EXISTS "Superadministrator can manage all chat histories" ON public.n8n_chat_histories;
        DROP POLICY IF EXISTS "Users can view chat histories from accessible notebooks" ON public.n8n_chat_histories;
        DROP POLICY IF EXISTS "Users can create chat histories in accessible notebooks" ON public.n8n_chat_histories;
        DROP POLICY IF EXISTS "Users can delete chat histories from accessible notebooks" ON public.n8n_chat_histories;
    END IF;
END $$;

-- ============================================================================
-- ELIMINAR TABLAS
-- ============================================================================

-- Eliminar tablas relacionadas con roles y organizaciones primero
DROP TABLE IF EXISTS public.user_roles_lookup CASCADE;
DROP TABLE IF EXISTS public.notebook_assignments CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- Eliminar tablas principales (en orden para respetar foreign keys)
-- NOTA: Esto eliminará TODOS los datos. Asegúrate de tener un backup si lo necesitas.
DROP TABLE IF EXISTS public.n8n_chat_histories CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.sources CASCADE;
DROP TABLE IF EXISTS public.notebooks CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- ELIMINAR ÍNDICES
-- ============================================================================

DROP INDEX IF EXISTS idx_user_roles_lookup_user_id;
DROP INDEX IF EXISTS idx_user_roles_lookup_role;
DROP INDEX IF EXISTS idx_notebook_assignments_notebook_id;
DROP INDEX IF EXISTS idx_notebook_assignments_user_id;
DROP INDEX IF EXISTS idx_notebook_assignments_user_notebook;
DROP INDEX IF EXISTS idx_organizations_name;
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_profiles_organization_id;
DROP INDEX IF EXISTS idx_notebooks_organization_id;

-- ============================================================================
-- ELIMINAR TIPOS ENUM (OPCIONAL - solo si no se usan en otros lugares)
-- ============================================================================

-- CUIDADO: Solo eliminar si estás seguro de que no se usa en otros lugares
-- DROP TYPE IF EXISTS user_role CASCADE;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Mostrar mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Limpieza completada. Ahora puedes ejecutar las migraciones desde cero.';
END $$;

