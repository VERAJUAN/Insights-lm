import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, UserProfile } from '@/types/roles';

export const useUserRole = () => {
  const { user, isAuthenticated } = useAuth();

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user || !isAuthenticated) {
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, organization_id, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }

      return data as UserProfile;
    },
    enabled: !!user && isAuthenticated,
  });

  const role: UserRole | null = profile?.role || null;
  const organizationId: string | null = profile?.organization_id || null;

  const isSuperadministrator = role === 'superadministrator';
  const isAdministrator = role === 'administrator';
  const isReader = role === 'reader';

  return {
    profile,
    role,
    organizationId,
    isSuperadministrator,
    isAdministrator,
    isReader,
    isLoading,
    error,
  };
};

