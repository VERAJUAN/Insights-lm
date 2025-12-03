
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import NotebookCard from './NotebookCard';
import { Check, Grid3X3, List, ChevronDown } from 'lucide-react';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { MAX_NOTEBOOKS_FOR_ADMINISTRATOR } from '@/utils/permissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const NotebookGrid = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('Más reciente');
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const {
    notebooks,
    isLoading,
    createNotebook,
    isCreating,
    canCreate,
    notebookCount,
    maxNotebooks
  } = useNotebooks();
  const { isSuperadministrator, isReader, isAdministrator } = useUserRole();
  const navigate = useNavigate();

  const sortedNotebooks = useMemo(() => {
    if (!notebooks) return [];
    
    const sorted = [...notebooks];
    
    if (sortBy === 'Más reciente') {
      return sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sortBy === 'Título') {
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    return sorted;
  }, [notebooks, sortBy]);

  const handleCreateNotebook = () => {
    // Check if administrator has reached the limit
    if (isAdministrator && notebookCount >= MAX_NOTEBOOKS_FOR_ADMINISTRATOR) {
      setShowLimitDialog(true);
      return;
    }

    // If can't create for other reasons, don't proceed
    if (!canCreate) {
      return;
    }

    createNotebook({
      title: 'Cuaderno sin título',
      description: ''
    }, {
      onSuccess: data => {
        console.log('Navigating to notebook:', data.id);
        navigate(`/notebook/${data.id}`);
      },
      onError: error => {
        console.error('Failed to create notebook:', error);
      }
    });
  };

  const handleNotebookClick = (notebookId: string, e: React.MouseEvent) => {
    // Check if the click is coming from a delete action or other interactive element
    const target = e.target as HTMLElement;
    const isDeleteAction = target.closest('[data-delete-action="true"]') || target.closest('.delete-button') || target.closest('[role="dialog"]');
    if (isDeleteAction) {
      console.log('Click prevented due to delete action');
      return;
    }
    navigate(`/notebook/${notebookId}`);
  };

  if (isLoading) {
    return <div className="text-center py-16">
        <p className="text-gray-600">Loading notebooks...</p>
      </div>;
  }

  return <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {isReader ? (
            <div>
              <h2 className="text-xl font-medium text-gray-900">Tus cuadernos disponibles</h2>
              <p className="text-sm text-gray-500 mt-1">
                Estos son los cuadernos que han sido asignados para ti
              </p>
            </div>
          ) : (
            <>
              <Button 
                className="bg-black hover:bg-gray-800 text-white rounded-full px-6" 
                onClick={handleCreateNotebook} 
                disabled={isCreating || (!canCreate && !isAdministrator)}
                title={!canCreate && maxNotebooks && !isAdministrator ? `Has alcanzado el límite de ${maxNotebooks} cuadernos` : ''}
              >
                {isCreating ? 'Creando...' : '+ Crear nuevo'}
              </Button>
              {maxNotebooks && (
                <span className="text-sm text-gray-500">
                  {notebookCount} / {maxNotebooks} cuadernos
                </span>
              )}
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-2 bg-white rounded-lg border px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="text-sm text-gray-600">{sortBy}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSortBy('Más reciente')} className="flex items-center justify-between">
                Más reciente
                {sortBy === 'Más reciente' && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('Título')} className="flex items-center justify-between">
                Título
                {sortBy === 'Título' && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedNotebooks.map(notebook => <div key={notebook.id} onClick={e => handleNotebookClick(notebook.id, e)}>
            <NotebookCard notebook={{
          id: notebook.id,
          title: notebook.title,
          date: new Date(notebook.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          sources: notebook.sources?.[0]?.count || 0,
          icon: notebook.icon || '📝',
          color: notebook.color || 'bg-gray-100',
          organizationName: isSuperadministrator ? (notebook as any).organization_name : undefined
        }} />
          </div>)}
      </div>

      {/* Alert Dialog for Notebook Limit */}
      <AlertDialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Límite de cuadernos alcanzado</AlertDialogTitle>
            <AlertDialogDescription>
              Está superando la cantidad de cuadernos máximo permitido. Contacte con el proveedor para ampliar la capacidad.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowLimitDialog(false)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};

export default NotebookGrid;
