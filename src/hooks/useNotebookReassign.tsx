import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useNotebookReassign = () => {
  const queryClient = useQueryClient();

  const reassignNotebook = useMutation({
    mutationFn: async ({ 
      notebookId, 
      targetOrganizationId 
    }: { 
      notebookId: string; 
      targetOrganizationId: string | null;
    }) => {
      console.log('Reassigning notebook:', notebookId, 'to organization:', targetOrganizationId);

      const { data, error } = await supabase
        .from('notebooks')
        .update({ organization_id: targetOrganizationId })
        .eq('id', notebookId)
        .select()
        .single();

      if (error) {
        console.error('Error reassigning notebook:', error);
        throw error;
      }

      console.log('Notebook reassigned successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['allOrganizationsWithDetails'] });
      toast({
        title: 'Cuaderno reasignado',
        description: 'El cuaderno ha sido reasignado exitosamente.',
      });
    },
    onError: (error: Error) => {
      console.error('Error reassigning notebook:', error);
      toast({
        title: 'Error al reasignar cuaderno',
        description: error.message || 'Ocurrió un error al reasignar el cuaderno.',
        variant: 'destructive',
      });
    },
  });

  return {
    reassignNotebook: reassignNotebook.mutate,
    isReassigning: reassignNotebook.isPending,
  };
};

