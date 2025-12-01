import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useNotebookPublic = (notebookId?: string) => {
  const queryClient = useQueryClient();

  // Fetch notebook public status
  const { data: notebook, isLoading } = useQuery({
    queryKey: ['notebook', notebookId, 'public'],
    queryFn: async () => {
      if (!notebookId) return null;

      const { data, error } = await supabase
        .from('notebooks')
        .select('id, is_public, public_slug')
        .eq('id', notebookId)
        .single();

      if (error) {
        console.error('Error fetching notebook public status:', error);
        throw error;
      }

      return data;
    },
    enabled: !!notebookId,
  });

  const togglePublic = useMutation({
    mutationFn: async ({ makePublic }: { makePublic: boolean }) => {
      if (!notebookId) {
        throw new Error('Notebook ID is required');
      }

      const updateData: any = { is_public: makePublic };
      
      // If making public, the trigger will generate the slug automatically
      // If making private, clear the slug
      if (!makePublic) {
        updateData.public_slug = null;
      }

      const { data, error } = await supabase
        .from('notebooks')
        .update(updateData)
        .eq('id', notebookId)
        .select()
        .single();

      if (error) {
        console.error('Error updating notebook public status:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notebook', notebookId, 'public'] });
      queryClient.invalidateQueries({ queryKey: ['notebook', notebookId] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      
      if (data.is_public) {
        toast({
          title: 'Cuaderno hecho público',
          description: 'El cuaderno ahora es accesible públicamente. Cualquiera con el enlace puede verlo y chatear.',
        });
      } else {
        toast({
          title: 'Cuaderno hecho privado',
          description: 'El cuaderno ya no es accesible públicamente.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al cambiar visibilidad',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    isPublic: notebook?.is_public || false,
    publicSlug: notebook?.public_slug || null,
    isLoading,
    togglePublic: togglePublic.mutate,
    isToggling: togglePublic.isPending,
  };
};

