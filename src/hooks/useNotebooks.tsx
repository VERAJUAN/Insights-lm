
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from './useUserRole';
import { canCreateNotebook, MAX_NOTEBOOKS_FOR_ADMINISTRATOR } from '@/utils/permissions';
import { toast } from '@/hooks/use-toast';

export const useNotebooks = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { role, organizationId, isSuperadministrator, isAdministrator, isReader } = useUserRole();
  const queryClient = useQueryClient();

  const {
    data: notebooks = [],
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: ['notebooks', user?.id, role],
    queryFn: async () => {
      if (!user) {
        console.log('No user found, returning empty notebooks array');
        return [];
      }
      
      console.log('Fetching notebooks for user:', user.id, 'role:', role);
      
      let query = supabase
        .from('notebooks')
        .select('*');

      // Filter notebooks based on role
      if (isSuperadministrator) {
        // Superadministrator can see all notebooks
        // No filter needed - RLS will handle it
      } else if (isAdministrator) {
        // Administrator can see notebooks from their organization
        query = query.eq('organization_id', organizationId);
      } else if (isReader) {
        // Reader can only see assigned notebooks
        const { data: assignments } = await supabase
          .from('notebook_assignments')
          .select('notebook_id')
          .eq('user_id', user.id);

        if (!assignments || assignments.length === 0) {
          return [];
        }

        const notebookIds = assignments.map(a => a.notebook_id);
        query = query.in('id', notebookIds);
      } else {
        // Default: user's own notebooks
        query = query.eq('user_id', user.id);
      }

      const { data: notebooksData, error: notebooksError } = await query
        .order('updated_at', { ascending: false });

      if (notebooksError) {
        console.error('Error fetching notebooks:', notebooksError);
        throw notebooksError;
      }

      // Then get source counts separately for each notebook
      const notebooksWithCounts = await Promise.all(
        (notebooksData || []).map(async (notebook) => {
          const { count, error: countError } = await supabase
            .from('sources')
            .select('*', { count: 'exact', head: true })
            .eq('notebook_id', notebook.id);

          if (countError) {
            console.error('Error fetching source count for notebook:', notebook.id, countError);
            return { ...notebook, sources: [{ count: 0 }] };
          }

          return { ...notebook, sources: [{ count: count || 0 }] };
        })
      );

      console.log('Fetched notebooks:', notebooksWithCounts?.length || 0);
      return notebooksWithCounts || [];
    },
    enabled: isAuthenticated && !authLoading,
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Set up real-time subscription for notebooks updates
  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;

    console.log('Setting up real-time subscription for notebooks');

    const channel = supabase
      .channel('notebooks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notebooks',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Real-time notebook update received:', payload);
          
          // Invalidate and refetch notebooks when any change occurs
          queryClient.invalidateQueries({ queryKey: ['notebooks', user.id] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAuthenticated, queryClient]);

  const createNotebook = useMutation({
    mutationFn: async (notebookData: { title: string; description?: string }) => {
      console.log('Creating notebook with data:', notebookData);
      console.log('Current user:', user?.id, 'role:', role);
      
      if (!user) {
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      // Check if user can create notebooks
      if (!canCreateNotebook(role, notebooks.length)) {
        if (isAdministrator && notebooks.length >= MAX_NOTEBOOKS_FOR_ADMINISTRATOR) {
          throw new Error(`Has alcanzado el límite de ${MAX_NOTEBOOKS_FOR_ADMINISTRATOR} cuadernos permitidos para administradores.`);
        }
        throw new Error('No tienes permisos para crear cuadernos.');
      }

      // Prepare notebook data
      const insertData: any = {
        title: notebookData.title,
        description: notebookData.description,
        user_id: user.id,
        generation_status: 'pending',
      };

      // Add organization_id if user is administrator
      if (isAdministrator && organizationId) {
        insertData.organization_id = organizationId;
      }

      const { data, error } = await supabase
        .from('notebooks')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating notebook:', error);
        throw error;
      }
      
      console.log('Notebook created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('Mutation success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['notebooks', user?.id, role] });
    },
    onError: (error: Error) => {
      console.error('Mutation error:', error);
      toast({
        title: 'Error al crear cuaderno',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    notebooks,
    isLoading: authLoading || isLoading,
    error: error?.message || null,
    isError,
    createNotebook: createNotebook.mutate,
    isCreating: createNotebook.isPending,
    canCreate: canCreateNotebook(role, notebooks.length),
    notebookCount: notebooks.length,
    maxNotebooks: isAdministrator ? MAX_NOTEBOOKS_FOR_ADMINISTRATOR : null,
  };
};
