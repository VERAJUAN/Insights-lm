import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/ui/Logo';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { Loader2, Save, Upload, X } from 'lucide-react';

const OrganizationBrandingEditor = () => {
  const { organization, updateBranding, isUpdatingBranding } = useOrganizationBranding();
  const [name, setName] = useState(organization?.name || '');
  const [logoUrl, setLogoUrl] = useState(organization?.logo_url || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(organization?.name || '');
    setLogoUrl(organization?.logo_url || '');
    setLogoFile(null);
    setLogoPreview(null);
  }, [organization?.name, organization?.logo_url]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Tipo de archivo no permitido. Solo se permiten imágenes (PNG, JPG, GIF, SVG, WEBP)');
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('El archivo es demasiado grande. El tamaño máximo es 5MB');
        return;
      }

      setLogoFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear URL input when file is selected
      setLogoUrl('');
    }
  };

  const handleRemoveFile = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    updateBranding({
      name: name.trim(),
      logoUrl: logoUrl.trim() || undefined,
      logoFile: logoFile || undefined,
    });
  };

  if (!organization) {
    return null;
  }

  const hasChanges =
    name.trim() !== (organization.name || '') ||
    logoUrl.trim() !== (organization.logo_url || '') ||
    logoFile !== null;

  const displayLogo = logoPreview || logoUrl || organization.logo_url;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Branding de la Organización</CardTitle>
        <CardDescription>
          Define el <strong>nombre</strong> y el <strong>logo</strong> que verán todos los usuarios de tu organización
          en lugar del branding genérico de CampusLM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          {displayLogo ? (
            <Logo size="md" src={displayLogo} alt={name || organization.name} />
          ) : (
            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-gray-400 text-xs">Sin logo</span>
            </div>
          )}
          <div className="text-sm text-gray-600">
            Vista previa del logo que se mostrará en el encabezado de la aplicación y en los cuadernos.
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-name">Nombre de la organización</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Campus de Ciencias de la Salud"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-logo">Logo</Label>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUpdatingBranding}
                className="w-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                {logoFile ? 'Cambiar archivo' : 'Subir logo'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUpdatingBranding}
              />
              {logoFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{logoFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Sube una imagen (PNG, JPG, GIF, SVG, WEBP). Tamaño máximo: 5MB. Idealmente con fondo transparente.
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">O</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-logo-url" className="text-sm">O ingresa una URL del logo</Label>
              <Input
                id="org-logo-url"
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  // Clear file when URL is entered
                  if (e.target.value.trim()) {
                    setLogoFile(null);
                    setLogoPreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }
                }}
                placeholder="https://.../logo.png"
                disabled={!!logoFile}
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isUpdatingBranding || !hasChanges || !name.trim()}
          className="w-full sm:w-auto"
        >
          {isUpdatingBranding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar branding
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default OrganizationBrandingEditor;


