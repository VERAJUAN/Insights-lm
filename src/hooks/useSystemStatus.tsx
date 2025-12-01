import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';

export interface SystemStatus {
  isEmpty: boolean;
  counts: {
    organizations: number;
    users: number;
    notebooks: number;
  };
}

export const useSystemStatus = () => {
  const { isSuperadministrator } = useUserRole();

  const {
    data: status,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: async (): Promise<SystemStatus> => {
      // Fetch counts in parallel
      const [orgsResult, usersResult, notebooksResult] = await Promise.all([
        supabase
          .from('organizations')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('notebooks')
          .select('id', { count: 'exact', head: true }),
      ]);

      const orgCount = orgsResult.count || 0;
      const userCount = usersResult.count || 0;
      const notebookCount = notebooksResult.count || 0;

      return {
        isEmpty: orgCount === 0 && userCount === 0 && notebookCount === 0,
        counts: {
          organizations: orgCount,
          users: userCount,
          notebooks: notebookCount,
        },
      };
    },
    enabled: isSuperadministrator,
  });

  return {
    status: status || {
      isEmpty: false,
      counts: { organizations: 0, users: 0, notebooks: 0 },
    },
    isLoading,
    error,
  };
};

