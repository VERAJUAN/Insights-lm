import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';
import { useUserRole } from './useUserRole';
import { toast } from '@/hooks/use-toast';

export const useOrganizationBranding = () => {
  const { organization } = useOrganization();
  const { isAdministrator } = useUserRole();
  const queryClient = useQueryClient();

  const convertFileToDataURL = async (file: File): Promise<string> => {
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no permitido. Solo se permiten imágenes (PNG, JPG, GIF, SVG, WEBP)');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande. El tamaño máximo es 5MB');
    }

    // Convert file to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Error al convertir el archivo'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  };

  const updateBranding = useMutation({
    mutationFn: async (params: { name: string; logoUrl?: string; logoFile?: File }) => {
      if (!organization?.id) {
        throw new Error('No organization found');
      }

      if (!isAdministrator) {
        throw new Error('Only administrators can update organization branding');
      }

      let finalLogoUrl = params.logoUrl || organization.logo_url || null;

      // If a file is provided, convert it to base64 data URL
      if (params.logoFile) {
        finalLogoUrl = await convertFileToDataURL(params.logoFile);
      }

      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: params.name,
          logo_url: finalLogoUrl,
        })
        .eq('id', organization.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating organization branding:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({
        title: 'Branding actualizado',
        description: 'El nombre y logo de la organización han sido actualizados exitosamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar branding',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    organization,
    updateBranding: updateBranding.mutate,
    isUpdatingBranding: updateBranding.isPending,
    error: updateBranding.error,
  };
};


