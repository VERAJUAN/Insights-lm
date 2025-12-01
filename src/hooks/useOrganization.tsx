import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { Organization } from '@/types/roles';

export const useOrganization = () => {
  const { organizationId, isAdministrator, isReader } = useUserRole();

  const {
    data: organization,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async (): Promise<Organization | null> => {
      if (!organizationId) {
        return null;
      }

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (error) {
        console.error('Error fetching organization:', error);
        throw error;
      }

      return data as Organization;
    },
    enabled: !!organizationId && (isAdministrator || isReader),
  });

  return {
    organization,
    isLoading,
    error,
  };
};

