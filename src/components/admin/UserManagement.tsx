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
import { Loader2, Search, UserCog, UserPlus, Trash2, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
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
  const { isSuperadministrator, isAdministrator, organizationId } = useUserRole();
  const queryClient = useQueryClient();
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'superadministrator' | 'administrator' | 'reader'>('reader');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [selectedFullName, setSelectedFullName] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'administrator' | 'reader'>('reader');
  const [newUserOrganizationId, setNewUserOrganizationId] = useState<string>('');

  // Fetch users - all for superadministrator, only readers from organization for administrator
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['allUsers', searchEmail, isAdministrator ? organizationId : null],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, email, full_name, role, organization_id, organizations(name)')
        .order('created_at', { ascending: false });

      if (isAdministrator && organizationId) {
        // Administrators can only see readers from their organization
        query = query
          .eq('organization_id', organizationId)
          .eq('role', 'reader');
      }

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
    enabled: isSuperadministrator || isAdministrator,
  });

  // Fetch all organizations (for superadministrator) or current organization (for administrator)
  const { data: organizations = [] } = useQuery({
    queryKey: ['allOrganizations', isAdministrator ? organizationId : null],
    queryFn: async () => {
      if (isAdministrator && organizationId) {
        // Administrator only needs their own organization
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', organizationId)
          .single();

        if (error) {
          console.error('Error fetching organization:', error);
          throw error;
        }

        return data ? [data] : [];
      } else {
        // Superadministrator gets all organizations
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name');

        if (error) {
          console.error('Error fetching organizations:', error);
          throw error;
        }

        return data || [];
      }
    },
    enabled: isSuperadministrator || isAdministrator,
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role, organizationId, fullName }: { userId: string; role?: string; organizationId?: string; fullName?: string }) => {
      const updateData: any = {};

      if (role !== undefined) {
        updateData.role = role;
      }

      if (fullName !== undefined) {
        updateData.full_name = fullName;
      }

      if (organizationId !== undefined) {
        if (organizationId) {
          updateData.organization_id = organizationId;
        } else if (role !== 'superadministrator') {
          // Clear organization_id if not superadministrator and no org provided
          updateData.organization_id = null;
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setIsDialogOpen(false);
      setSelectedUserId(null);
      setSelectedFullName('');
      toast({
        title: 'Usuario actualizado',
        description: isAdministrator ? 'El usuario ha sido actualizado exitosamente.' : 'El rol del usuario ha sido actualizado exitosamente.',
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

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      // Delete user using admin API
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      });

      if (error) {
        console.error('Error invoking admin-delete-user function:', error);
        throw new Error(error.message || 'Error al eliminar el usuario');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Error al eliminar el usuario');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      toast({
        title: 'Usuario eliminado',
        description: 'El usuario ha sido eliminado exitosamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEditUser = (user: any) => {
    setSelectedUserId(user.id);
    setSelectedRole(user.role || 'reader');
    setSelectedOrganizationId(user.organization_id || '');
    setSelectedFullName(user.full_name || '');
    setIsDialogOpen(true);
  };

  const handleDeleteUser = (user: any) => {
    setUserToDelete({ id: user.id, email: user.email });
    setIsDeleteDialogOpen(true);
  };

  const createUser = useMutation({
    mutationFn: async ({
      email,
      password,
      fullName,
      role,
      organizationId,
    }: {
      email: string;
      password: string;
      fullName: string;
      role: 'administrator' | 'reader';
      organizationId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email,
          password,
          fullName,
          role,
          organizationId,
        },
      });

      if (error) {
        console.error('Error invoking admin-create-user function:', error);
        throw new Error(error.message || 'Error al crear el usuario');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Error al crear el usuario');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setIsCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setNewUserRole('reader');
      setNewUserOrganizationId('');
      toast({
        title: 'Usuario creado',
        description: 'El usuario ha sido creado exitosamente. Se ha enviado un email de confirmación.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!selectedUserId) return;

    if (isAdministrator) {
      // Administrators can only update full_name for readers
      updateUserRole.mutate({
        userId: selectedUserId,
        fullName: selectedFullName,
      });
    } else {
      // Superadministrators can update role and organization
      updateUserRole.mutate({
        userId: selectedUserId,
        role: selectedRole,
        organizationId: selectedRole !== 'superadministrator' ? selectedOrganizationId : undefined,
      });
    }
  };

  const handleCreateUser = () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa el email y la contraseña.',
        variant: 'destructive',
      });
      return;
    }

    // For administrators, automatically use their organization and set role to reader
    const finalOrganizationId = isAdministrator ? organizationId : newUserOrganizationId;
    const finalRole = isAdministrator ? 'reader' : newUserRole;

    if (!finalOrganizationId) {
      toast({
        title: 'Organización requerida',
        description: 'Por favor selecciona una organización para este usuario.',
        variant: 'destructive',
      });
      return;
    }

    createUser.mutate({
      email: newUserEmail.trim(),
      password: newUserPassword,
      fullName: newUserFullName.trim() || '',
      role: finalRole,
      organizationId: finalOrganizationId,
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

  if (!isSuperadministrator && !isAdministrator) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Usuarios</CardTitle>
        <CardDescription>
          {isSuperadministrator 
            ? 'Gestiona los roles y organizaciones de todos los usuarios del sistema.'
            : 'Gestiona los usuarios lectores de tu organización.'}
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
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Crear Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  {isAdministrator 
                    ? 'Crea un nuevo usuario lector para tu organización.'
                    : 'Crea un nuevo usuario y asígnalo a una organización como administrador o lector.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email *</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Contraseña *</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-fullname">Nombre Completo</Label>
                  <Input
                    id="new-fullname"
                    value={newUserFullName}
                    onChange={(e) => setNewUserFullName(e.target.value)}
                    placeholder="Nombre del usuario"
                  />
                </div>
                {isSuperadministrator && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="new-role">Rol *</Label>
                      <Select value={newUserRole} onValueChange={(value: any) => setNewUserRole(value)}>
                        <SelectTrigger id="new-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="administrator">Administrador</SelectItem>
                          <SelectItem value="reader">Lector</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-organization">Organización *</Label>
                      <Select
                        value={newUserOrganizationId}
                        onValueChange={setNewUserOrganizationId}
                      >
                        <SelectTrigger id="new-organization">
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
                  </>
                )}
                {isAdministrator && organizations.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="new-organization">Organización</Label>
                    <Input
                      id="new-organization"
                      value={organizations[0]?.name || ''}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500">
                      El usuario se creará automáticamente como lector en tu organización.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={createUser.isPending || !newUserEmail.trim() || !newUserPassword.trim() || (isSuperadministrator && !newUserOrganizationId)}
                >
                  {createUser.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear Usuario'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem 
                              onSelect={(e) => {
                                e.preventDefault();
                                handleEditUser(user);
                              }} 
                              className="cursor-pointer"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onSelect={(e) => {
                                e.preventDefault();
                                handleDeleteUser(user);
                              }} 
                              className="cursor-pointer text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedUserId(null);
            setSelectedFullName('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                {isAdministrator 
                  ? 'Modifica el nombre completo del usuario lector.'
                  : 'Cambia el rol y la organización del usuario.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {isAdministrator ? (
                <div className="space-y-2">
                  <Label htmlFor="edit-fullname">Nombre Completo</Label>
                  <Input
                    id="edit-fullname"
                    value={selectedFullName}
                    onChange={(e) => setSelectedFullName(e.target.value)}
                    placeholder="Nombre del usuario"
                  />
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                setSelectedUserId(null);
                setSelectedFullName('');
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateUserRole.isPending || (!isAdministrator && selectedRole !== 'superadministrator' && !selectedOrganizationId)}
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

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este usuario?</AlertDialogTitle>
              <AlertDialogDescription>
                Estás a punto de eliminar el usuario <strong>{userToDelete?.email}</strong>. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsDeleteDialogOpen(false);
                setUserToDelete(null);
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (userToDelete) {
                    deleteUser.mutate(userToDelete.id);
                  }
                }} 
                className="bg-red-600 hover:bg-red-700 text-white" 
                disabled={deleteUser.isPending}
              >
                {deleteUser.isPending ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default UserManagement;

