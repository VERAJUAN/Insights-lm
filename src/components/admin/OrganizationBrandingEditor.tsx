import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/ui/Logo';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { Loader2, Save } from 'lucide-react';

const OrganizationBrandingEditor = () => {
  const { organization, updateBranding, isUpdatingBranding } = useOrganizationBranding();
  const [name, setName] = useState(organization?.name || '');
  const [logoUrl, setLogoUrl] = useState(organization?.logo_url || '');

  useEffect(() => {
    setName(organization?.name || '');
    setLogoUrl(organization?.logo_url || '');
  }, [organization?.name, organization?.logo_url]);

  const handleSave = () => {
    updateBranding({
      name: name.trim(),
      logoUrl: logoUrl.trim(),
    });
  };

  if (!organization) {
    return null;
  }

  const hasChanges =
    name.trim() !== (organization.name || '') ||
    logoUrl.trim() !== (organization.logo_url || '');

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
          <Logo size="md" src={logoUrl || organization.logo_url} alt={name || organization.name} />
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
          <Label htmlFor="org-logo-url">URL del logo</Label>
          <Input
            id="org-logo-url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://.../logo.png"
          />
          <p className="text-xs text-gray-500">
            Usa una URL directa a una imagen (PNG, JPG, etc.). Idealmente con fondo transparente.
          </p>
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


