import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useOrganizationPrompt } from '@/hooks/useOrganizationPrompt';
import { Loader2, Save } from 'lucide-react';

const OrganizationPromptEditor = () => {
  const { prompt, updatePrompt, isUpdating } = useOrganizationPrompt();
  const [localPrompt, setLocalPrompt] = useState(prompt);

  React.useEffect(() => {
    setLocalPrompt(prompt);
  }, [prompt]);

  const handleSave = () => {
    updatePrompt(localPrompt);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt Personalizado de la Organización</CardTitle>
        <CardDescription>
          Personaliza el comportamiento del agente de IA para tu organización. Este prompt se utilizará en todas las respuestas del agente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder="Ingresa el prompt personalizado para tu organización..."
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-sm text-gray-500">
            Este prompt será enviado al agente de IA en N8N para personalizar las respuestas según las necesidades de tu organización.
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isUpdating || localPrompt === prompt}
          className="w-full sm:w-auto"
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Prompt
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default OrganizationPromptEditor;

