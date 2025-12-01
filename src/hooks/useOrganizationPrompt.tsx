import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';
import { useUserRole } from './useUserRole';
import { toast } from '@/hooks/use-toast';

export const useOrganizationPrompt = () => {
  const { organization } = useOrganization();
  const { isAdministrator } = useUserRole();
  const queryClient = useQueryClient();

  const updatePrompt = useMutation({
    mutationFn: async (customPrompt: string) => {
      if (!organization?.id) {
        throw new Error('No organization found');
      }

      if (!isAdministrator) {
        throw new Error('Only administrators can update the organization prompt');
      }

      const { data, error } = await supabase
        .from('organizations')
        .update({ custom_prompt: customPrompt })
        .eq('id', organization.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating organization prompt:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organization?.id] });
      toast({
        title: 'Prompt actualizado',
        description: 'El prompt personalizado de la organización ha sido actualizado exitosamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar prompt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    prompt: organization?.custom_prompt || '',
    updatePrompt: updatePrompt.mutate,
    isUpdating: updatePrompt.isPending,
    error: updatePrompt.error,
  };
};

