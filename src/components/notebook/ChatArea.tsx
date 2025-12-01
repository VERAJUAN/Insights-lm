import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Upload, FileText, Loader2, RefreshCw, Copy, Check, Edit2, X, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useSources } from '@/hooks/useSources';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNotebookUpdate } from '@/hooks/useNotebookUpdate';
import { Textarea } from '@/components/ui/textarea';
import MarkdownRenderer from '@/components/chat/MarkdownRenderer';
import SaveToNoteButton from './SaveToNoteButton';
import AddSourcesDialog from './AddSourcesDialog';
import { Citation } from '@/types/message';

interface ChatAreaProps {
  hasSource: boolean;
  notebookId?: string;
  notebook?: {
    id: string;
    title: string;
    description?: string;
    generation_status?: string;
    icon?: string;
    example_questions?: string[];
  } | null;
  onCitationClick?: (citation: Citation) => void;
  isPublic?: boolean;
}

const ChatArea = ({
  hasSource,
  notebookId,
  notebook,
  onCitationClick,
  isPublic = false
}: ChatAreaProps) => {
  const [message, setMessage] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [showAiLoading, setShowAiLoading] = useState(false);
  const [clickedQuestions, setClickedQuestions] = useState<Set<string>>(new Set());
  const [showAddSourcesDialog, setShowAddSourcesDialog] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  
  const isGenerating = notebook?.generation_status === 'generating';
  
  const {
    messages,
    sendMessage,
    isSending,
    deleteChatHistory,
    isDeletingChatHistory
  } = useChatMessages(notebookId, isPublic);
  
  const { user } = useAuth();
  const { isReader, isLoading: isLoadingRole, isAdministrator, isSuperadministrator } = useUserRole();
  const isReadOnly = isReader || isPublic;
  const { toast } = useToast();
  const { updateNotebook, isUpdating } = useNotebookUpdate();
  const canEditDescription = (isAdministrator || isSuperadministrator) && notebookId && !isPublic;
  const {
    sources
  } = useSources(notebookId);
  
  const sourceCount = sources?.length || 0;

  // For readers, show content if notebook exists (even without sources)
  // For other users, require sources
  // Don't show empty state while loading role to prevent button flash
  const shouldShowContent = isLoadingRole
    ? !!notebook // While loading, show content if notebook exists (prevents empty state flash)
    : (isReadOnly 
      ? !!notebook // Readers can see content if notebook exists
      : hasSource); // Other users need sources

  // Check if at least one source has been successfully processed
  // For readers and public users, assume sources are processed if they have access to the notebook
  const hasProcessedSource = isReadOnly 
    ? true // Readers and public users can chat if they have access to the notebook (assumes sources are processed)
    : sources?.some(source => source.processing_status === 'completed') || false;

  // Chat should be disabled if there are no processed sources (except for readers)
  const isChatDisabled = !hasProcessedSource;

  // Track when we send a message to show loading state
  const [lastMessageCount, setLastMessageCount] = useState(0);

  // Ref for auto-scrolling to the most recent message
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // For anonymous users, check if the pending message is already in messages
  // This prevents showing the message twice (once from pendingUserMessage, once from messages)
  const shouldShowPendingMessage = useMemo(() => {
    if (!pendingUserMessage) return false;
    
    // For anonymous users, check if message is already in the messages array
    if (isPublic && !user?.id) {
      const isInMessages = messages.some(msg => 
        msg.message.type === 'human' &&
        typeof msg.message.content === 'string' &&
        msg.message.content === pendingUserMessage
      );
      return !isInMessages; // Only show pending if not already in messages
    }
    
    return true; // For authenticated users, always show pending
  }, [pendingUserMessage, messages, isPublic, user?.id]);
  useEffect(() => {
    // If we have new messages and we have a pending message, clear it
    if (messages.length > lastMessageCount) {
      // Check if the last message is from AI (which means the response arrived)
      const lastMessage = messages[messages.length - 1];
      const isAiMessage = lastMessage?.message?.type === 'ai' || lastMessage?.message?.role === 'assistant';
      
      if (pendingUserMessage && isAiMessage) {
        console.log('AI response received, clearing loading state');
        setPendingUserMessage(null);
        setShowAiLoading(false);
      } else if (pendingUserMessage && messages.length > lastMessageCount) {
        // If we have more messages but no AI response yet, keep waiting
        console.log('More messages received, but waiting for AI response');
      }
    }
    setLastMessageCount(messages.length);
  }, [messages, lastMessageCount, pendingUserMessage]);

  // Auto-scroll when pending message is set, when messages update, or when AI loading appears
  useEffect(() => {
    if (latestMessageRef.current && scrollAreaRef.current) {
      // Find the viewport within the ScrollArea
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        // Use a small delay to ensure the DOM has updated
        setTimeout(() => {
          latestMessageRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }, 50);
      }
    }
  }, [pendingUserMessage, messages.length, showAiLoading]);
  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || message.trim();
    if (textToSend && notebookId) {
      try {
        // Store the pending message to display immediately
        setPendingUserMessage(textToSend);
        await sendMessage({
          notebookId: notebookId,
          role: 'user',
          content: textToSend
        });
        setMessage('');

        // Show AI loading after user message is sent
        setShowAiLoading(true);
      } catch (error) {
        console.error('Failed to send message:', error);
        // Clear pending message on error
        setPendingUserMessage(null);
        setShowAiLoading(false);
      }
    }
  };
  const handleRefreshChat = () => {
    if (notebookId) {
      deleteChatHistory(notebookId);
      // Reset clicked questions when chat is refreshed
      setClickedQuestions(new Set());
    }
  };
  const handleCitationClick = (citation: Citation) => {
    onCitationClick?.(citation);
  };
  const handleExampleQuestionClick = (question: string) => {
    // Add question to clicked set to remove it from display
    setClickedQuestions(prev => new Set(prev).add(question));
    setMessage(question);
    handleSendMessage(question);
  };

  // Helper function to extract plain text from message content
  const extractPlainText = (content: string | { segments: any[]; citations: any[] }): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object' && content && 'segments' in content && Array.isArray(content.segments)) {
      // Extract text from all segments
      return content.segments.map((segment: any) => segment.text || '').join(' ');
    }
    
    return String(content);
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = async (content: string | { segments: any[]; citations: any[] }) => {
    try {
      const textToCopy = extractPlainText(content);
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Copiado",
        description: "La respuesta ha sido copiada al portapapeles.",
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Handle description editing
  const handleStartEditDescription = () => {
    setEditedDescription(notebook?.description || '');
    setIsEditingDescription(true);
  };

  const handleCancelEditDescription = () => {
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  const handleSaveDescription = async () => {
    if (!notebookId) return;
    
    try {
      await updateNotebook({
        id: notebookId,
        updates: { description: editedDescription || null }
      });
      setIsEditingDescription(false);
      toast({
        title: "Resumen actualizado",
        description: "El resumen del cuaderno ha sido actualizado correctamente.",
      });
    } catch (error: any) {
      console.error('Error updating description:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el resumen. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Helper function to determine if message is from user
  const isUserMessage = (msg: any) => {
    const messageType = msg.message?.type || msg.message?.role;
    return messageType === 'human' || messageType === 'user';
  };

  // Helper function to determine if message is from AI
  const isAiMessage = (msg: any) => {
    const messageType = msg.message?.type || msg.message?.role;
    return messageType === 'ai' || messageType === 'assistant';
  };

  // Get the index of the last message for auto-scrolling
  const shouldShowScrollTarget = () => {
    return messages.length > 0 || pendingUserMessage || showAiLoading;
  };

  // Show refresh button if there are any messages (including system messages)
  const shouldShowRefreshButton = messages.length > 0;

  // Get example questions from the notebook, filtering out clicked ones
  const exampleQuestions = notebook?.example_questions?.filter(q => !clickedQuestions.has(q)) || [];

  // Update placeholder text based on processing status
  const getPlaceholderText = () => {
    if (isReadOnly) {
      return "Escribe tu pregunta...";
    }
    if (isChatDisabled) {
      if (sourceCount === 0) {
        return "Sube una fuente para comenzar...";
      } else {
        return "Por favor espera mientras se procesan tus fuentes...";
      }
    }
    return "Comienza a escribir...";
  };
  return <div className="flex-1 flex flex-col h-full overflow-hidden">
      {shouldShowContent ? <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Chat</h2>
              {shouldShowRefreshButton && <Button variant="ghost" size="sm" onClick={handleRefreshChat} disabled={isDeletingChatHistory || isChatDisabled} className="flex items-center space-x-2">
                  <RefreshCw className={`h-4 w-4 ${isDeletingChatHistory ? 'animate-spin' : ''}`} />
                  <span>{isDeletingChatHistory ? 'Limpiando...' : 'Limpiar chat'}</span>
                </Button>}
            </div>
          </div>

          <ScrollArea className="flex-1 h-full" ref={scrollAreaRef}>
            {/* Document Summary */}
            <div className="p-8 border-b border-gray-200">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-10 h-10 flex items-center justify-center bg-transparent">
                    {isGenerating ? <Loader2 className="text-black font-normal w-10 h-10 animate-spin" /> : <span className="text-[40px] leading-none">{notebook?.icon || '☕'}</span>}
                  </div>
                  <div>
                    <h1 className="text-2xl font-medium text-gray-900">
                      {isGenerating ? 'Generando contenido...' : notebook?.title || 'Cuaderno sin título'}
                    </h1>
                    {!isReader && <p className="text-sm text-gray-600">{sourceCount} fuente{sourceCount !== 1 ? 's' : ''}</p>}
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6 mb-6 relative">
                  {isGenerating ? (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <p>La IA está analizando tu fuente y generando un título y descripción...</p>
                    </div>
                  ) : isEditingDescription ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        placeholder="Escribe el resumen del cuaderno..."
                        className="min-h-[120px] resize-none"
                        disabled={isUpdating}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEditDescription}
                          disabled={isUpdating}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveDescription}
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Guardar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group">
                      <MarkdownRenderer 
                        content={notebook?.description || 'No hay descripción disponible para este cuaderno.'} 
                        className="prose prose-gray max-w-none text-gray-700 leading-relaxed" 
                      />
                      {canEditDescription && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleStartEditDescription}
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Editar resumen"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Chat Messages */}
                {(messages.length > 0 || shouldShowPendingMessage || showAiLoading) && <div className="mb-6 space-y-4">
                    {messages.map((msg, index) => <div key={msg.id} className={`flex ${isUserMessage(msg) ? 'justify-end' : 'justify-start'}`}>
                        <div className={`${isUserMessage(msg) ? 'max-w-xs lg:max-w-md px-4 py-2 bg-blue-500 text-white rounded-lg' : 'w-full'}`}>
                          <div className={isUserMessage(msg) ? '' : 'prose prose-gray max-w-none text-gray-800'}>
                            <MarkdownRenderer content={msg.message.content} className={isUserMessage(msg) ? '' : ''} onCitationClick={handleCitationClick} isUserMessage={isUserMessage(msg)} />
                          </div>
                          {isAiMessage(msg) && <div className="mt-2 flex justify-start items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyToClipboard(msg.message.content)}
                                className="flex items-center space-x-1 text-gray-600 hover:text-gray-800"
                                title="Copiar respuesta"
                              >
                                <Copy className="h-3 w-3" />
                                <span className="text-xs">Copiar</span>
                              </Button>
                              <SaveToNoteButton content={msg.message.content} notebookId={notebookId} isPublic={isPublic} />
                            </div>}
                        </div>
                      </div>)}
                    
                    {/* Pending user message - only show if not already in messages */}
                    {shouldShowPendingMessage && <div className="flex justify-end">
                        <div className="max-w-xs lg:max-w-md px-4 py-2 bg-blue-500 text-white rounded-lg">
                          <MarkdownRenderer content={pendingUserMessage} className="" isUserMessage={true} />
                        </div>
                      </div>}
                    
                    {/* AI Loading Indicator */}
                    {showAiLoading && <div className="flex justify-start" ref={latestMessageRef}>
                        <div className="flex items-center space-x-2 px-4 py-3 bg-gray-100 rounded-lg">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{
                    animationDelay: '0.1s'
                  }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{
                    animationDelay: '0.2s'
                  }}></div>
                        </div>
                      </div>}
                    
                    {/* Scroll target for when no AI loading is shown */}
                    {!showAiLoading && shouldShowScrollTarget() && <div ref={latestMessageRef} />}
                  </div>}
              </div>
            </div>
          </ScrollArea>

          {/* Chat Input - Fixed at bottom */}
          <div className="p-6 border-t border-gray-200 flex-shrink-0">
            <div className="max-w-4xl mx-auto">
              <div className="flex space-x-4">
                <div className="flex-1 relative">
                  <Input placeholder={getPlaceholderText()} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && !isChatDisabled && !isSending && !pendingUserMessage && handleSendMessage()} className={isReader ? "" : "pr-12"} disabled={isChatDisabled || isSending || !!pendingUserMessage} />
                  {!isReader && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                      {sourceCount} fuente{sourceCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <Button onClick={() => handleSendMessage()} disabled={!message.trim() || isChatDisabled || isSending || !!pendingUserMessage}>
                  {isSending || pendingUserMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              
              {/* Example Questions Carousel */}
              {!isChatDisabled && !pendingUserMessage && !showAiLoading && exampleQuestions.length > 0 && <div className="mt-4">
                  <Carousel className="w-full max-w-4xl">
                    <CarouselContent className="-ml-2 md:-ml-4">
                      {exampleQuestions.map((question, index) => <CarouselItem key={index} className="pl-2 md:pl-4 basis-auto">
                          <Button variant="outline" size="sm" className="text-left whitespace-nowrap h-auto py-2 px-3 text-sm" onClick={() => handleExampleQuestionClick(question)}>
                            {question}
                          </Button>
                        </CarouselItem>)}
                    </CarouselContent>
                    {exampleQuestions.length > 2 && <>
                        <CarouselPrevious className="left-0" />
                        <CarouselNext className="right-0" />
                      </>}
                  </Carousel>
                </div>}
            </div>
          </div>
        </div> :
    // Empty State
    <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-gray-100">
              <Upload className="h-8 w-8 text-slate-600" />
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-4">
              {isReadOnly ? 'Chat con el cuaderno' : 'Agrega una fuente para comenzar'}
            </h2>
            {!isReadOnly && !isLoadingRole && (
              <Button onClick={() => setShowAddSourcesDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Subir una fuente
              </Button>
            )}
          </div>

          {/* Bottom Input */}
          <div className="w-full max-w-2xl">
            <div className="flex space-x-4">
              <Input placeholder="Sube una fuente para comenzar" disabled className="flex-1" />
              <div className="flex items-center text-sm text-gray-500">
                0 fuentes
              </div>
              <Button disabled>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>}
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <p className="text-center text-sm text-gray-500">CampusLM puede ser impreciso; por favor verifica sus respuestas.</p>
      </div>
      
      {/* Add Sources Dialog */}
      <AddSourcesDialog open={showAddSourcesDialog} onOpenChange={setShowAddSourcesDialog} notebookId={notebookId} />
    </div>;
};

export default ChatArea;
