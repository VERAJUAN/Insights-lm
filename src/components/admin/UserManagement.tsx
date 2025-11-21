import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import { Loader2, Search, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const UserManagement = () => {
  const { isSuperadministrator } = useUserRole();
  const queryClient = useQueryClient();
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'superadministrator' | 'administrator' | 'reader'>('reader');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch all users (only for superadministrator)
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['allUsers', searchEmail],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, email, full_name, role, organization_id, organizations(name)')
        .order('created_at', { ascending: false });

      if (searchEmail) {
        query = query.ilike('email', `%${searchEmail}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      return data || [];
    },
    enabled: isSuperadministrator,
  });

  // Fetch all organizations
  const { data: organizations = [] } = useQuery({
    queryKey: ['allOrganizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching organizations:', error);
        throw error;
      }

      return data || [];
    },
    enabled: isSuperadministrator,
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role, organizationId }: { userId: string; role: string; organizationId?: string }) => {
      const updateData: any = { role };

      if (organizationId) {
        updateData.organization_id = organizationId;
      } else if (role !== 'superadministrator') {
        // Clear organization_id if not superadministrator and no org provided
        updateData.organization_id = null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user role:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setIsDialogOpen(false);
      setSelectedUserId(null);
      toast({
        title: 'Usuario actualizado',
        description: 'El rol del usuario ha sido actualizado exitosamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEditUser = (user: any) => {
    setSelectedUserId(user.id);
    setSelectedRole(user.role || 'reader');
    setSelectedOrganizationId(user.organization_id || '');
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedUserId) return;

    updateUserRole.mutate({
      userId: selectedUserId,
      role: selectedRole,
      organizationId: selectedRole !== 'superadministrator' ? selectedOrganizationId : undefined,
    });
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'superadministrator':
        return <Badge variant="destructive">Superadministrador</Badge>;
      case 'administrator':
        return <Badge variant="default">Administrador</Badge>;
      case 'reader':
        return <Badge variant="secondary">Lector</Badge>;
      default:
        return <Badge variant="outline">Sin rol</Badge>;
    }
  };

  if (!isSuperadministrator) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Usuarios</CardTitle>
        <CardDescription>
          Gestiona los roles y organizaciones de todos los usuarios del sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {isLoadingUsers ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Organización</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.full_name || '-'}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{user.organizations?.name || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <UserCog className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Cambia el rol y la organización del usuario.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadministrator">Superadministrador</SelectItem>
                    <SelectItem value="administrator">Administrador</SelectItem>
                    <SelectItem value="reader">Lector</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRole !== 'superadministrator' && (
                <div className="space-y-2">
                  <Label htmlFor="organization">Organización</Label>
                  <Select
                    value={selectedOrganizationId}
                    onValueChange={setSelectedOrganizationId}
                  >
                    <SelectTrigger id="organization">
                      <SelectValue placeholder="Selecciona una organización" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org: any) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateUserRole.isPending || (selectedRole !== 'superadministrator' && !selectedOrganizationId)}
              >
                {updateUserRole.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default UserManagement;

