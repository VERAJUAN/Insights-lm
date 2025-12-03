import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, LogOut, Globe, GlobeLock, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotebookUpdate } from '@/hooks/useNotebookUpdate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLogout } from '@/services/authService';
import Logo from '@/components/ui/Logo';
import { useUserRole } from '@/hooks/useUserRole';
import { useNotebookPublic } from '@/hooks/useNotebookPublic';
import { useOrganization } from '@/hooks/useOrganization';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NotebookHeaderProps {
  title: string;
  notebookId?: string;
}

const NotebookHeader = ({ title, notebookId }: NotebookHeaderProps) => {
  const navigate = useNavigate();
  const { logout } = useLogout();
  const { profile, isAdministrator, isSuperadministrator } = useUserRole();
  const { organization } = useOrganization();
  const brandName = organization?.name || 'CampusLM';
  const fullName = profile?.full_name || '';
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [showPublicDialog, setShowPublicDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const { updateNotebook, isUpdating } = useNotebookUpdate();
  const { isPublic, publicSlug, togglePublic, isToggling } = useNotebookPublic(notebookId);
  
  const canManagePublic = (isAdministrator || isSuperadministrator) && notebookId;

  const handleTitleClick = () => {
    if (notebookId) {
      setIsEditing(true);
      setEditedTitle(title);
    }
  };

  const handleTitleSubmit = () => {
    if (notebookId && editedTitle.trim() && editedTitle !== title) {
      updateNotebook({
        id: notebookId,
        updates: { title: editedTitle.trim() }
      });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleTitleSubmit();
  };

  const handleIconClick = () => {
    navigate('/');
  };

  const handleTogglePublic = () => {
    if (isPublic) {
      // Making private
      togglePublic({ makePublic: false });
    } else {
      // Making public - show warning dialog
      setShowPublicDialog(true);
    }
  };

  const handleConfirmMakePublic = () => {
    togglePublic({ makePublic: true });
    setShowPublicDialog(false);
  };

  const handleCopyLink = () => {
    if (publicSlug) {
      const publicUrl = `${window.location.origin}/public/notebook/${publicSlug}`;
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const publicUrl = publicSlug ? `${window.location.origin}/public/notebook/${publicSlug}` : '';

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleIconClick}
              className="hover:bg-gray-50 rounded transition-colors p-1"
            >
              <Logo src={organization?.logo_url || undefined} alt={brandName} />
            </button>
            {isEditing ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="text-lg font-medium text-gray-900 border-none shadow-none p-0 h-auto focus-visible:ring-0 min-w-[300px] w-auto"
                autoFocus
                disabled={isUpdating}
              />
            ) : (
              <span 
                className="text-lg font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                onClick={handleTitleClick}
              >
                {title}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {canManagePublic && (
            <div className="flex items-center space-x-2">
              {isPublic ? (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar enlace
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTogglePublic}
                    disabled={isToggling}
                    className="text-xs"
                  >
                    <GlobeLock className="h-3 w-3 mr-1" />
                    {isToggling ? 'Cambiando...' : 'Hacer privado'}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTogglePublic}
                  disabled={isToggling}
                  className="text-xs"
                >
                  <Globe className="h-3 w-3 mr-1" />
                  {isToggling ? 'Cambiando...' : 'Hacer público'}
                </Button>
              )}
            </div>
          )}
          <div className="flex items-center space-x-2">
            {fullName && (
              <span className="text-sm text-gray-700">
                Hola {fullName}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors">
                    <User className="h-4 w-4 text-white" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Make Public Dialog */}
      <Dialog open={showPublicDialog} onOpenChange={setShowPublicDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hacer cuaderno público</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres hacer este cuaderno público?
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-yellow-200 bg-yellow-50">
            <Globe className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Advertencia:</strong> Al hacer este cuaderno público, cualquier persona con el enlace podrá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Ver el cuaderno y su contenido</li>
                <li>Chatear con el cuaderno (con los mismos permisos de lector)</li>
                <li>No necesitará estar logueado</li>
              </ul>
              <p className="mt-2">
                <strong>Nota:</strong> Los cuadernos públicos no pueden ser asignados a lectores, ya que son accesibles para todos.
              </p>
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublicDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmMakePublic} disabled={isToggling}>
              {isToggling ? 'Haciendo público...' : 'Sí, hacer público'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Public Link Dialog - Show when making public */}
      {isPublic && publicSlug && (
        <Dialog open={false} onOpenChange={() => {}}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enlace público del cuaderno</DialogTitle>
              <DialogDescription>
                Comparte este enlace para que cualquiera pueda acceder al cuaderno sin necesidad de iniciar sesión.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Input
                  value={publicUrl}
                  readOnly
                  className="font-mono text-sm"
                />
              </div>
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800 text-sm">
                  Cualquiera con este enlace podrá ver y chatear con este cuaderno.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPublicDialog(false)}>
                Cerrar
              </Button>
              <Button onClick={handleCopyLink}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar enlace
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </header>
  );
};

export default NotebookHeader;
