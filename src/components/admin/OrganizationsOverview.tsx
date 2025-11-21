import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAllOrganizations } from '@/hooks/useAllOrganizations';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, BookOpen, Building2, MoreVertical, Copy, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNotebookDuplicate } from '@/hooks/useNotebookDuplicate';
import { useNotebookReassign } from '@/hooks/useNotebookReassign';
import { useNotebookDelete } from '@/hooks/useNotebookDelete';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const OrganizationsOverview = () => {
  const { organizations, isLoading, error } = useAllOrganizations();
  const [showDuplicateDialog, setShowDuplicateDialog] = useState<{ notebookId: string; open: boolean }>({ notebookId: '', open: false });
  const [showReassignDialog, setShowReassignDialog] = useState<{ notebookId: string; open: boolean }>({ notebookId: '', open: false });
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ notebookId: string; open: boolean }>({ notebookId: '', open: false });
  const [selectedOrgForDuplicate, setSelectedOrgForDuplicate] = useState<string>('none');
  const [selectedOrgForReassign, setSelectedOrgForReassign] = useState<string>('none');
  
  const { duplicateNotebook, isDuplicating } = useNotebookDuplicate();
  const { reassignNotebook, isReassigning } = useNotebookReassign();
  const { deleteNotebook, isDeleting } = useNotebookDelete();

  // Fetch all organizations
  const { data: allOrganizations = [] } = useQuery({
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
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organizaciones</CardTitle>
          <CardDescription>Vista general de todas las organizaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleDuplicateClick = (notebookId: string) => {
    setShowDuplicateDialog({ notebookId, open: true });
    setSelectedOrgForDuplicate('none');
  };

  const handleReassignClick = (notebookId: string) => {
    setShowReassignDialog({ notebookId, open: true });
    setSelectedOrgForReassign('none');
  };

  const handleDeleteClick = (notebookId: string) => {
    setShowDeleteDialog({ notebookId, open: true });
  };

  const handleConfirmDuplicate = () => {
    duplicateNotebook({
      notebookId: showDuplicateDialog.notebookId,
      targetOrganizationId: selectedOrgForDuplicate === 'none' ? null : selectedOrgForDuplicate,
    });
    setShowDuplicateDialog({ notebookId: '', open: false });
    setSelectedOrgForDuplicate('none');
  };

  const handleConfirmReassign = () => {
    reassignNotebook({
      notebookId: showReassignDialog.notebookId,
      targetOrganizationId: selectedOrgForReassign === 'none' ? null : selectedOrgForReassign,
    });
    setShowReassignDialog({ notebookId: '', open: false });
    setSelectedOrgForReassign('none');
  };

  const handleConfirmDelete = () => {
    deleteNotebook(showDeleteDialog.notebookId);
    setShowDeleteDialog({ notebookId: '', open: false });
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organizaciones</CardTitle>
          <CardDescription>Vista general de todas las organizaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600">Error al cargar organizaciones</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Organizaciones
        </CardTitle>
        <CardDescription>
          Vista general de todas las organizaciones, usuarios y cuadernos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {organizations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No hay organizaciones registradas</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {organizations.map((org) => (
              <AccordionItem key={org.id} value={org.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{org.name}</span>
                      <Badge variant="outline">{org.userCount} usuarios</Badge>
                      <Badge variant="outline">{org.notebookCount} cuadernos</Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 pt-4">
                    {/* Users Section */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Usuarios ({org.userCount})
                      </h4>
                      {org.users.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay usuarios en esta organización</p>
                      ) : (
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Rol</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {org.users.map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.email}</TableCell>
                                  <TableCell>{user.full_name || '-'}</TableCell>
                                  <TableCell>
                                    {user.role === 'administrator' && (
                                      <Badge variant="default">Administrador</Badge>
                                    )}
                                    {user.role === 'reader' && (
                                      <Badge variant="secondary">Lector</Badge>
                                    )}
                                    {!user.role && (
                                      <Badge variant="outline">Sin rol</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Notebooks Section */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Cuadernos ({org.notebookCount})
                      </h4>
                      {org.notebooks.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay cuadernos en esta organización</p>
                      ) : (
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Creado</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {org.notebooks.map((notebook) => (
                                <TableRow key={notebook.id}>
                                  <TableCell className="font-medium">{notebook.title}</TableCell>
                                  <TableCell>
                                    {new Date(notebook.created_at).toLocaleDateString('es-ES', {
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
                                            handleDuplicateClick(notebook.id);
                                          }} 
                                          className="cursor-pointer"
                                        >
                                          <Copy className="h-4 w-4 mr-2" />
                                          Duplicar cuaderno
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onSelect={(e) => {
                                            e.preventDefault();
                                            handleReassignClick(notebook.id);
                                          }} 
                                          className="cursor-pointer"
                                        >
                                          <Building2 className="h-4 w-4 mr-2" />
                                          Reasignar organización
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                          onSelect={(e) => {
                                            e.preventDefault();
                                            handleDeleteClick(notebook.id);
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
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Custom Prompt */}
                    {org.custom_prompt && (
                      <div>
                        <h4 className="font-medium mb-2">Prompt Personalizado</h4>
                        <div className="bg-gray-50 p-3 rounded-md border">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {org.custom_prompt}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      {/* Duplicate Dialog */}
      <Dialog open={showDuplicateDialog.open} onOpenChange={(open) => setShowDuplicateDialog({ notebookId: '', open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar Cuaderno</DialogTitle>
            <DialogDescription>
              Crea una copia de este cuaderno. Puedes asignarlo a una organización específica o dejarlo sin organización.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="duplicate-org">Organización de destino (Opcional)</Label>
              <Select value={selectedOrgForDuplicate} onValueChange={setSelectedOrgForDuplicate}>
                <SelectTrigger id="duplicate-org">
                  <SelectValue placeholder="Sin organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin organización</SelectItem>
                  {allOrganizations.map((org: any) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDuplicateDialog({ notebookId: '', open: false });
              setSelectedOrgForDuplicate('none');
            }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDuplicate} disabled={isDuplicating}>
              {isDuplicating ? 'Duplicando...' : 'Duplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={showReassignDialog.open} onOpenChange={(open) => setShowReassignDialog({ notebookId: '', open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reasignar Cuaderno</DialogTitle>
            <DialogDescription>
              Cambia la organización a la que pertenece este cuaderno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reassign-org">Nueva Organización</Label>
              <Select value={selectedOrgForReassign} onValueChange={setSelectedOrgForReassign}>
                <SelectTrigger id="reassign-org">
                  <SelectValue placeholder="Sin organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin organización</SelectItem>
                  {allOrganizations.map((org: any) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReassignDialog({ notebookId: '', open: false });
              setSelectedOrgForReassign('none');
            }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmReassign} disabled={isReassigning}>
              {isReassigning ? 'Reasignando...' : 'Reasignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog.open} onOpenChange={(open) => setShowDeleteDialog({ notebookId: '', open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este cuaderno?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar este cuaderno y todo su contenido. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog({ notebookId: '', open: false })}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-blue-600 hover:bg-blue-700" disabled={isDeleting}>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default OrganizationsOverview;

