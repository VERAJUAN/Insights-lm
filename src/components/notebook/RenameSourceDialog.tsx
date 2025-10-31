
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSourceUpdate } from '@/hooks/useSourceUpdate';

interface RenameSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: any;
  notebookId?: string;
}

const RenameSourceDialog = ({ open, onOpenChange, source, notebookId }: RenameSourceDialogProps) => {
  const [title, setTitle] = useState('');
  const { updateSource, isUpdating } = useSourceUpdate();

  useEffect(() => {
    if (source && open) {
      setTitle(source.title);
    }
  }, [source, open]);

  const handleSave = async () => {
    if (!source || !title.trim()) return;

    await updateSource({
      sourceId: source.id,
      title: title.trim(),
    });

    onOpenChange(false);
    setTitle('');
  };

  const handleCancel = () => {
    onOpenChange(false);
    setTitle('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>¿Renombrar {source?.title}?</DialogTitle>
          <DialogDescription>
            Ingresa un nuevo nombre para esta fuente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="source-name">Nombre de la fuente *</Label>
            <Input
              id="source-name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ingresa el nombre de la fuente"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!title.trim() || isUpdating}
          >
            {isUpdating ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenameSourceDialog;
