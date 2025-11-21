import React, { useState } from 'react';
import { Trash2, MoreVertical, Copy, Building2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNotebookDelete } from '@/hooks/useNotebookDelete';
import { useNotebookDuplicate } from '@/hooks/useNotebookDuplicate';
import { useNotebookReassign } from '@/hooks/useNotebookReassign';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NotebookCardProps {
  notebook: {
    id: string;
    title: string;
    date: string;
    sources: number;
    icon: string;
    color: string;
    hasCollaborators?: boolean;
    organizationName?: string | null;
  };
}

const NotebookCard = ({
  notebook
}: NotebookCardProps) => {
  const { isSuperadministrator } = useUserRole();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedOrgForDuplicate, setSelectedOrgForDuplicate] = useState<string>('none');
  const [selectedOrgForReassign, setSelectedOrgForReassign] = useState<string>('none');
  
  const {
    deleteNotebook,
    isDeleting
  } = useNotebookDelete();
  
  const {
    duplicateNotebook,
    isDuplicating
  } = useNotebookDuplicate();
  
  const {
    reassignNotebook,
    isReassigning
  } = useNotebookReassign();

  // Fetch all organizations for superadministrator
  const { data: organizations = [] } = useQuery({
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Delete button clicked for notebook:', notebook.id);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Confirming delete for notebook:', notebook.id);
    deleteNotebook(notebook.id);
    setShowDeleteDialog(false);
  };

  const handleDuplicateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowDuplicateDialog(true);
  };

  const handleReassignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowReassignDialog(true);
  };

  const handleConfirmDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    duplicateNotebook({
      notebookId: notebook.id,
      targetOrganizationId: selectedOrgForDuplicate === 'none' ? null : selectedOrgForDuplicate,
    });
    setShowDuplicateDialog(false);
    setSelectedOrgForDuplicate('none');
  };

  const handleConfirmReassign = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    reassignNotebook({
      notebookId: notebook.id,
      targetOrganizationId: selectedOrgForReassign === 'none' ? null : selectedOrgForReassign,
    });
    setShowReassignDialog(false);
    setSelectedOrgForReassign('none');
  };

  // Generate CSS classes from color name
  const colorName = notebook.color || 'gray';
  const backgroundClass = `bg-${colorName}-100`;
  const borderClass = `border-${colorName}-200`;

  return <div 
      className={`rounded-lg border ${borderClass} ${backgroundClass} p-4 hover:shadow-md transition-shadow cursor-pointer relative h-48 flex flex-col`}
    >
      <div className="absolute top-3 right-3 flex items-center gap-1" data-delete-action="true">
        {isSuperadministrator && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                onClick={(e) => e.stopPropagation()} 
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors" 
                data-delete-action="true"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleDuplicateClick(e as any);
                }} 
                className="cursor-pointer"
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicar cuaderno
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleReassignClick(e as any);
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
                  handleDeleteClick(e as any);
                }} 
                className="cursor-pointer text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isSuperadministrator && (
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <button onClick={handleDeleteClick} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors delete-button" disabled={isDeleting} data-delete-action="true">
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este cuaderno?</AlertDialogTitle>
                <AlertDialogDescription>
                  Estás a punto de eliminar este cuaderno y todo su contenido. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-blue-600 hover:bg-blue-700" disabled={isDeleting}>
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Delete Dialog for superadministrator */}
      {isSuperadministrator && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este cuaderno?</AlertDialogTitle>
              <AlertDialogDescription>
                Estás a punto de eliminar este cuaderno y todo su contenido. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-blue-600 hover:bg-blue-700" disabled={isDeleting}>
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Duplicate Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
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
                  {organizations.map((org: any) => (
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
              setShowDuplicateDialog(false);
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
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
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
                  {organizations.map((org: any) => (
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
              setShowReassignDialog(false);
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
      
      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4">
        <span className="text-3xl">{notebook.icon}</span>
      </div>
      
      <h3 className="text-gray-900 mb-2 pr-6 line-clamp-2 text-2xl font-normal flex-grow">
        {notebook.title}
      </h3>
      
      {notebook.organizationName && (
        <div className="mb-2">
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
            {notebook.organizationName}
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between text-sm text-gray-500 mt-auto">
        <span>{notebook.date} • {notebook.sources} fuente{notebook.sources !== 1 ? 's' : ''}</span>
      </div>
    </div>;
};

export default NotebookCard;
