import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import SourcesSidebar from '@/components/notebook/SourcesSidebar';
import ChatArea from '@/components/notebook/ChatArea';
import StudioSidebar from '@/components/notebook/StudioSidebar';
import MobileNotebookTabs from '@/components/notebook/MobileNotebookTabs';
import { Citation } from '@/types/message';
import Logo from '@/components/ui/Logo';
import { Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const PublicNotebook = () => {
  const { slug } = useParams<{ slug: string }>();
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const isDesktop = useIsDesktop();

  // Fetch public notebook by slug
  const { data: notebook, isLoading, error } = useQuery({
    queryKey: ['publicNotebook', slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('public_slug', slug)
        .eq('is_public', true)
        .single();

      if (error) {
        console.error('Error fetching public notebook:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Cuaderno no encontrado o no es público');
      }

      return data;
    },
    enabled: !!slug,
  });

  // Public users (not logged in) should NOT see sources (same permissions as reader)
  // They can only chat with the notebook
  const hasSource = false; // Always false for public users
  const isSourceDocumentOpen = !!selectedCitation;

  const handleCitationClick = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  const handleCitationClose = () => {
    setSelectedCitation(null);
  };

  // Dynamic width calculations for desktop
  const sourcesWidth = isSourceDocumentOpen ? 'w-[35%]' : 'w-[25%]';
  const studioWidth = 'w-[30%]';
  const chatWidth = isSourceDocumentOpen ? 'w-[35%]' : 'w-[45%]';

  if (isLoading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando cuaderno...</p>
        </div>
      </div>
    );
  }

  if (error || !notebook) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <Logo />
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">Cuaderno no encontrado</h1>
          <p className="text-gray-600">
            El cuaderno que buscas no existe o no es público.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Public Notebook Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Logo />
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-medium text-gray-900">
                  {notebook.title}
                </h1>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Globe className="h-3 w-3 mr-1" />
                  Público
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <Alert className="mt-3 border-blue-200 bg-blue-50">
          <Globe className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            Este es un cuaderno público. Puedes chatear con él sin necesidad de iniciar sesión.
          </AlertDescription>
        </Alert>
      </header>

      {isDesktop ? (
        // Desktop layout (3-column)
        <div className="flex-1 flex overflow-hidden">
          <div className={`${sourcesWidth} flex-shrink-0`}>
            <SourcesSidebar 
              hasSource={hasSource || false} 
              notebookId={notebook.id}
              selectedCitation={selectedCitation}
              onCitationClose={handleCitationClose}
              setSelectedCitation={setSelectedCitation}
              isPublic={true}
            />
          </div>
          
          <div className={`${chatWidth} flex-shrink-0`}>
            <ChatArea 
              hasSource={hasSource || false} 
              notebookId={notebook.id}
              notebook={notebook}
              onCitationClick={handleCitationClick}
              isPublic={true}
            />
          </div>
          
          <div className={`${studioWidth} flex-shrink-0`}>
            <StudioSidebar 
              notebookId={notebook.id} 
              onCitationClick={handleCitationClick}
              isPublic={true}
            />
          </div>
        </div>
      ) : (
        // Mobile/Tablet layout (tabs)
        <MobileNotebookTabs
          hasSource={hasSource || false}
          notebookId={notebook.id}
          notebook={notebook}
          selectedCitation={selectedCitation}
          onCitationClose={handleCitationClose}
          setSelectedCitation={setSelectedCitation}
          onCitationClick={handleCitationClick}
          isPublic={true}
        />
      )}
    </div>
  );
};

export default PublicNotebook;

