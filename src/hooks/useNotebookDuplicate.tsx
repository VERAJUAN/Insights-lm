import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useNotebookDuplicate = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const duplicateNotebook = useMutation({
    mutationFn: async ({ 
      notebookId, 
      targetOrganizationId 
    }: { 
      notebookId: string; 
      targetOrganizationId?: string | null;
    }) => {
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      console.log('Duplicating notebook:', notebookId, 'to organization:', targetOrganizationId);

      // Fetch the original notebook
      const { data: originalNotebook, error: notebookError } = await supabase
        .from('notebooks')
        .select('*')
        .eq('id', notebookId)
        .single();

      if (notebookError || !originalNotebook) {
        console.error('Error fetching original notebook:', notebookError);
        throw notebookError || new Error('Cuaderno no encontrado');
      }

      // Create new notebook with copied data
      const newNotebookData: any = {
        title: `${originalNotebook.title} (Copia)`,
        description: originalNotebook.description,
        color: originalNotebook.color,
        icon: originalNotebook.icon,
        user_id: user.id,
        organization_id: targetOrganizationId || null,
        generation_status: 'completed',
        example_questions: originalNotebook.example_questions,
      };

      const { data: newNotebook, error: createError } = await supabase
        .from('notebooks')
        .insert(newNotebookData)
        .select()
        .single();

      if (createError || !newNotebook) {
        console.error('Error creating duplicate notebook:', createError);
        throw createError || new Error('Error al crear el cuaderno duplicado');
      }

      // Fetch all sources from the original notebook
      const { data: sources, error: sourcesError } = await supabase
        .from('sources')
        .select('*')
        .eq('notebook_id', notebookId);

      if (sourcesError) {
        console.error('Error fetching sources:', sourcesError);
        // Continue even if sources fetch fails
      }

      // Copy sources to the new notebook
      if (sources && sources.length > 0) {
        const sourcesToInsert = sources.map(source => ({
          notebook_id: newNotebook.id,
          title: source.title,
          type: source.type,
          url: source.url,
          file_path: source.file_path,
          file_size: source.file_size,
          display_name: source.display_name,
          content: source.content,
          summary: source.summary,
          processing_status: 'completed',
          metadata: source.metadata,
        }));

        const { error: insertSourcesError } = await supabase
          .from('sources')
          .insert(sourcesToInsert);

        if (insertSourcesError) {
          console.error('Error copying sources:', insertSourcesError);
          // Continue even if sources copy fails
        }
      }

      // Fetch all notes from the original notebook
      const { data: notes, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('notebook_id', notebookId);

      if (notesError) {
        console.error('Error fetching notes:', notesError);
        // Continue even if notes fetch fails
      }

      // Copy notes to the new notebook
      if (notes && notes.length > 0) {
        const notesToInsert = notes.map(note => ({
          notebook_id: newNotebook.id,
          title: note.title,
          content: note.content,
          source_type: note.source_type,
          extracted_text: note.extracted_text,
        }));

        const { error: insertNotesError } = await supabase
          .from('notes')
          .insert(notesToInsert);

        if (insertNotesError) {
          console.error('Error copying notes:', insertNotesError);
          // Continue even if notes copy fails
        }
      }

      console.log('Notebook duplicated successfully:', newNotebook.id);
      return newNotebook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['allOrganizationsWithDetails'] });
      toast({
        title: 'Cuaderno duplicado',
        description: 'El cuaderno ha sido duplicado exitosamente.',
      });
    },
    onError: (error: Error) => {
      console.error('Error duplicating notebook:', error);
      toast({
        title: 'Error al duplicar cuaderno',
        description: error.message || 'Ocurrió un error al duplicar el cuaderno.',
        variant: 'destructive',
      });
    },
  });

  return {
    duplicateNotebook: duplicateNotebook.mutate,
    isDuplicating: duplicateNotebook.isPending,
  };
};

