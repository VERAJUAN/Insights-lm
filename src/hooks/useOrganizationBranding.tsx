import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';
import { useUserRole } from './useUserRole';
import { toast } from '@/hooks/use-toast';

export const useOrganizationBranding = () => {
  const { organization } = useOrganization();
  const { isAdministrator } = useUserRole();
  const queryClient = useQueryClient();

  const updateBranding = useMutation({
    mutationFn: async (params: { name: string; logoUrl: string }) => {
      if (!organization?.id) {
        throw new Error('No organization found');
      }

      if (!isAdministrator) {
        throw new Error('Only administrators can update organization branding');
      }

      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: params.name,
          logo_url: params.logoUrl || null,
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


