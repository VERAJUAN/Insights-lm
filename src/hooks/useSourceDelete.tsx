
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useSourceDelete = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const deleteSource = useMutation({
    mutationFn: async (sourceId: string) => {
      console.log('Empezando el proceso de eliminación de la fuente:', sourceId);
      
      try {
        // First, get the source details including file information
        const { data: source, error: fetchError } = await supabase
          .from('sources')
          .select('id, title, file_path, type')
          .eq('id', sourceId)
          .single();

        if (fetchError) {
          console.error('Error al obtener la fuente:', fetchError);
          throw new Error('Failed to find source');
        }

        console.log('Encontrada fuente para eliminar:', source.title, 'con file_path:', source.file_path);

        // Delete the file from storage if it exists
        if (source.file_path) {
          console.log('Eliminando archivo del almacenamiento:', source.file_path);
          
          const { error: storageError } = await supabase.storage
            .from('sources')
            .remove([source.file_path]);

          if (storageError) {
            console.error('Error al eliminar archivo del almacenamiento:', storageError);
            // Don't throw here - we still want to delete the database record
            // even if the file deletion fails (file might already be gone)
          } else {
            console.log('Archivo eliminado correctamente del almacenamiento');
          }
        } else {
          console.log('No hay archivo que eliminar del almacenamiento (fuente URL o no file_path)');
        }

        // Eliminar el registro de la fuente de la base de datos
        const { error: deleteError } = await supabase
          .from('sources')
          .delete()
          .eq('id', sourceId);

        if (deleteError) {
          console.error('Error al eliminar la fuente de la base de datos:', deleteError);
          throw deleteError;
        }
        
        console.log('Fuente eliminada correctamente de la base de datos');
        return source;
      } catch (error) {
        console.error('Error en el proceso de eliminación de la fuente:', error);
        throw error;
      }
    },
    onSuccess: (deletedSource) => {
      console.log('Eliminación de mutación exitosa, invalidando consultas');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast({
        title: "Fuente eliminada",
        description: `"${deletedSource?.title || 'Fuente'}" ha sido eliminada correctamente.`,
      });
    },
    onError: (error: any) => {
      console.error('Error en la mutación de eliminación:', error);
      
      let errorMessage = "No se pudo eliminar la fuente. Por favor, inténtelo de nuevo.";
      
      // Provide more specific error messages based on the error type
      if (error?.code === 'PGRST116') {
        errorMessage = "Fuente no encontrada o no tienes permisos para eliminarla.";
      } else if (error?.message?.includes('foreign key')) {
        errorMessage = "No se puede eliminar la fuente debido a dependencias de datos. Por favor, contacta al soporte.";
      } else if (error?.message?.includes('network')) {
        errorMessage = "Error de red. Por favor, verifica tu conexión y vuelve a intentarlo.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return {
    deleteSource: deleteSource.mutate,
    isDeleting: deleteSource.isPending,
  };
};
