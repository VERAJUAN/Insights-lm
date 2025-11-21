import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';

export interface OrganizationWithDetails {
  id: string;
  name: string;
  custom_prompt: string | null;
  created_at: string;
  updated_at: string;
  users: Array<{
    id: string;
    email: string;
    full_name: string | null;
    role: string | null;
  }>;
  notebooks: Array<{
    id: string;
    title: string;
    user_id: string;
    created_at: string;
  }>;
  userCount: number;
  notebookCount: number;
}

export const useAllOrganizations = () => {
  const { isSuperadministrator } = useUserRole();

  const {
    data: organizations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['allOrganizationsWithDetails'],
    queryFn: async (): Promise<OrganizationWithDetails[]> => {
      // Fetch all organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (orgsError) {
        console.error('Error fetching organizations:', orgsError);
        throw orgsError;
      }

      if (!orgs || orgs.length === 0) {
        return [];
      }

      // For each organization, fetch users and notebooks
      const organizationsWithDetails = await Promise.all(
        orgs.map(async (org) => {
          // Fetch users in this organization
          const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('id, email, full_name, role')
            .eq('organization_id', org.id)
            .order('created_at', { ascending: false });

          if (usersError) {
            console.error(`Error fetching users for org ${org.id}:`, usersError);
          }

          // Fetch notebooks in this organization
          const { data: notebooks, error: notebooksError } = await supabase
            .from('notebooks')
            .select('id, title, user_id, created_at')
            .eq('organization_id', org.id)
            .order('created_at', { ascending: false });

          if (notebooksError) {
            console.error(`Error fetching notebooks for org ${org.id}:`, notebooksError);
          }

          return {
            ...org,
            users: users || [],
            notebooks: notebooks || [],
            userCount: users?.length || 0,
            notebookCount: notebooks?.length || 0,
          } as OrganizationWithDetails;
        })
      );

      return organizationsWithDetails;
    },
    enabled: isSuperadministrator,
  });

  return {
    organizations,
    isLoading,
    error,
  };
};

