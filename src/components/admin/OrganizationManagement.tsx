import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Building2, Edit, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const OrganizationManagement = () => {
  const { isSuperadministrator } = useUserRole();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<{ id: string; name: string; custom_prompt: string | null } | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  // Fetch all organizations
  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['allOrganizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching organizations:', error);
        throw error;
      }

      return data || [];
    },
    enabled: isSuperadministrator,
  });

  const createOrganization = useMutation({
    mutationFn: async ({ name, prompt }: { name: string; prompt?: string }) => {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name,
          custom_prompt: prompt || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating organization:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['allOrganizationsWithDetails'] });
      setIsDialogOpen(false);
      setOrganizationName('');
      setCustomPrompt('');
      toast({
        title: 'Organización creada',
        description: 'La organización ha sido creada exitosamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear organización',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateOrganization = useMutation({
    mutationFn: async ({ id, name, prompt }: { id: string; name: string; prompt?: string }) => {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          name,
          custom_prompt: prompt || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating organization:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['allOrganizationsWithDetails'] });
      setIsEditDialogOpen(false);
      setEditingOrganization(null);
      setOrganizationName('');
      setCustomPrompt('');
      toast({
        title: 'Organización actualizada',
        description: 'La organización ha sido actualizada exitosamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar organización',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (!organizationName.trim()) {
      toast({
        title: 'Nombre requerido',
        description: 'Por favor ingresa un nombre para la organización.',
        variant: 'destructive',
      });
      return;
    }

    createOrganization.mutate({
      name: organizationName.trim(),
      prompt: customPrompt.trim() || undefined,
    });
  };

  const handleEdit = (org: any) => {
    setEditingOrganization(org);
    setOrganizationName(org.name);
    setCustomPrompt(org.custom_prompt || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!organizationName.trim()) {
      toast({
        title: 'Nombre requerido',
        description: 'Por favor ingresa un nombre para la organización.',
        variant: 'destructive',
      });
      return;
    }

    if (!editingOrganization) return;

    updateOrganization.mutate({
      id: editingOrganization.id,
      name: organizationName.trim(),
      prompt: customPrompt.trim() || undefined,
    });
  };

  if (!isSuperadministrator) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Gestión de Organizaciones
        </CardTitle>
        <CardDescription>
          Crea y gestiona organizaciones del sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear Organización
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Organización</DialogTitle>
                <DialogDescription>
                  Crea una nueva organización. Podrás asignar administradores y usuarios después.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Nombre de la Organización *</Label>
                  <Input
                    id="org-name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Ej: Universidad Nacional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-prompt">Prompt Personalizado (Opcional)</Label>
                  <Textarea
                    id="org-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Ingresa el prompt personalizado para esta organización..."
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-gray-500">
                    Este prompt se utilizará para personalizar las respuestas del agente de IA para esta organización.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createOrganization.isPending || !organizationName.trim()}
                >
                  {createOrganization.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear Organización'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingOrganization(null);
            setOrganizationName('');
            setCustomPrompt('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Organización</DialogTitle>
              <DialogDescription>
                Modifica el nombre y el prompt personalizado de la organización.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-org-name">Nombre de la Organización *</Label>
                <Input
                  id="edit-org-name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Ej: Universidad Nacional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-org-prompt">Prompt Personalizado (Opcional)</Label>
                <Textarea
                  id="edit-org-prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ingresa el prompt personalizado para esta organización..."
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-500">
                  Este prompt se utilizará para personalizar las respuestas del agente de IA para esta organización.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                setEditingOrganization(null);
                setOrganizationName('');
                setCustomPrompt('');
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateOrganization.isPending || !organizationName.trim()}
              >
                {updateOrganization.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Prompt Personalizado</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No hay organizaciones registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  organizations.map((org: any) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        {org.custom_prompt ? (
                          <span className="text-sm text-gray-600">Configurado</span>
                        ) : (
                          <span className="text-sm text-gray-400">Sin prompt</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(org.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
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
                                handleEdit(org);
                              }} 
                              className="cursor-pointer"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar organización
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
      </CardContent>
    </Card>
  );
};

export default OrganizationManagement;

