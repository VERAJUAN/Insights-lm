import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useUserRole } from '@/hooks/useUserRole';
import { useNotebooks } from '@/hooks/useNotebooks';
import { toast } from '@/hooks/use-toast';
import { Loader2, UserPlus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const NotebookAssignment = () => {
  const { organizationId, isAdministrator, isSuperadministrator } = useUserRole();
  const { notebooks } = useNotebooks();
  const queryClient = useQueryClient();
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Fetch readers in the organization (or all readers for superadministrator)
  const { data: readers = [], isLoading: isLoadingReaders } = useQuery({
    queryKey: ['organizationReaders', organizationId, isSuperadministrator],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, email, full_name, organization_id');

      if (isSuperadministrator) {
        // Superadministrator can see all readers
        query = query.eq('role', 'reader');
      } else if (organizationId) {
        // Administrator can only see readers in their organization
        query = query
          .eq('organization_id', organizationId)
          .eq('role', 'reader');
      } else {
        return [];
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching readers:', error);
        throw error;
      }

      return data || [];
    },
    enabled: (isAdministrator || isSuperadministrator) && (!!organizationId || isSuperadministrator),
  });

  // Fetch current assignments for selected notebook
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['notebookAssignments', selectedNotebookId],
    queryFn: async () => {
      if (!selectedNotebookId) return [];

      const { data, error } = await supabase
        .from('notebook_assignments')
        .select(`
          id,
          user_id,
          profiles (
            id,
            email,
            full_name
          )
        `)
        .eq('notebook_id', selectedNotebookId);

      if (error) {
        console.error('Error fetching assignments:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!selectedNotebookId,
  });

  const assignNotebook = useMutation({
    mutationFn: async ({ notebookId, userId }: { notebookId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('notebook_assignments')
        .insert({
          notebook_id: notebookId,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error assigning notebook:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebookAssignments', selectedNotebookId] });
      setSelectedUserId('');
      toast({
        title: 'Cuaderno asignado',
        description: 'El cuaderno ha sido asignado exitosamente al lector.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al asignar cuaderno',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('notebook_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) {
        console.error('Error removing assignment:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebookAssignments', selectedNotebookId] });
      toast({
        title: 'Asignación eliminada',
        description: 'La asignación del cuaderno ha sido eliminada exitosamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar asignación',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAssign = () => {
    if (!selectedNotebookId || !selectedUserId) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor selecciona un cuaderno y un lector.',
        variant: 'destructive',
      });
      return;
    }

    assignNotebook.mutate({ notebookId: selectedNotebookId, userId: selectedUserId });
  };

  const organizationNotebooks = notebooks.filter(n => 
    isSuperadministrator || (isAdministrator && n.organization_id === organizationId)
  );

  const availableReaders = readers.filter(reader => 
    !assignments.some(a => a.user_id === reader.id)
  );

  // Show message if administrator has no organization
  if (isAdministrator && !organizationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asignar Cuadernos a Lectores</CardTitle>
          <CardDescription>
            Asigna cuadernos específicos a los lectores de tu organización para que puedan acceder a ellos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">
              No tienes una organización asignada. Contacta a un superadministrador para que te asigne una organización.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asignar Cuadernos a Lectores</CardTitle>
        <CardDescription>
          {isSuperadministrator 
            ? 'Asigna cuadernos específicos a los lectores para que puedan acceder a ellos.'
            : 'Asigna cuadernos específicos a los lectores de tu organización para que puedan acceder a ellos.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="notebook">Seleccionar Cuaderno</Label>
          <Select value={selectedNotebookId} onValueChange={setSelectedNotebookId}>
            <SelectTrigger id="notebook">
              <SelectValue placeholder="Selecciona un cuaderno" />
            </SelectTrigger>
            <SelectContent>
              {organizationNotebooks.length === 0 ? (
                <SelectItem value="no-notebooks" disabled>
                  No hay cuadernos disponibles
                </SelectItem>
              ) : (
                organizationNotebooks.map((notebook) => (
                  <SelectItem key={notebook.id} value={notebook.id}>
                    {notebook.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {organizationNotebooks.length === 0 && (
            <p className="text-sm text-gray-500">
              {isSuperadministrator 
                ? 'No hay cuadernos en el sistema. Los administradores pueden crear cuadernos desde la pestaña "Cuadernos".'
                : 'No hay cuadernos en tu organización. Crea cuadernos desde la pestaña "Cuadernos".'}
            </p>
          )}
        </div>

        {selectedNotebookId && (
          <>
            <div className="space-y-2">
              <Label htmlFor="reader">Asignar a Lector</Label>
              <div className="flex gap-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="reader" className="flex-1">
                    <SelectValue placeholder="Selecciona un lector" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingReaders ? (
                      <SelectItem value="loading" disabled>
                        Cargando lectores...
                      </SelectItem>
                    ) : availableReaders.length === 0 ? (
                      <SelectItem value="no-readers" disabled>
                        No hay lectores disponibles
                      </SelectItem>
                    ) : (
                      availableReaders.map((reader) => (
                        <SelectItem key={reader.id} value={reader.id}>
                          {reader.full_name || reader.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssign}
                  disabled={!selectedUserId || assignNotebook.isPending}
                >
                  {assignNotebook.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lectores Asignados</Label>
              {isLoadingAssignments ? (
                <p className="text-sm text-gray-500">Cargando asignaciones...</p>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-gray-500">No hay lectores asignados a este cuaderno.</p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment: any) => {
                    const profile = Array.isArray(assignment.profiles) 
                      ? assignment.profiles[0] 
                      : assignment.profiles;
                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-2 border rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Lector</Badge>
                          <span className="text-sm">
                            {profile?.full_name || profile?.email || 'Usuario desconocido'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAssignment.mutate(assignment.id)}
                          disabled={removeAssignment.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NotebookAssignment;

