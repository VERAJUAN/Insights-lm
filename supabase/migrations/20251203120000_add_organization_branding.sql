-- ============================================================================
-- MIGRATION: Branding por organización (logo y nombre)
-- ============================================================================
-- Esta migración agrega soporte para que cada organización pueda definir
-- su propio logo (URL de imagen). El nombre ya existe en la columna "name".
-- ============================================================================

-- Agregar columna opcional para el logo de la organización
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS logo_url text;


