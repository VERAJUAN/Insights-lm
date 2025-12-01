
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EnhancedChatMessage, Citation, MessageSegment } from '@/types/message';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { useBrowserId, getBrowserId } from '@/hooks/useBrowserId';

// Helper functions for localStorage (for anonymous public users)
const getLocalStorageKey = (notebookId: string) => `chat-history-public-${notebookId}`;

const saveToLocalStorage = (notebookId: string, messages: EnhancedChatMessage[]) => {
  try {
    const key = getLocalStorageKey(notebookId);
    localStorage.setItem(key, JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

const loadFromLocalStorage = (notebookId: string): EnhancedChatMessage[] => {
  try {
    const key = getLocalStorageKey(notebookId);
    const data = localStorage.getItem(key);
    if (data) {
      const messages = JSON.parse(data) as EnhancedChatMessage[];
      return messages;
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  return [];
};

const clearLocalStorage = (notebookId: string) => {
  try {
    const key = getLocalStorageKey(notebookId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
};

// Type for the expected message structure from n8n_chat_histories
interface N8nMessageFormat {
  type: 'human' | 'ai';
  content: string | {
    segments: Array<{ text: string; citation_id?: number }>;
    citations: Array<{
      citation_id: number;
      source_id: string;
      source_title: string;
      source_type: string;
      page_number?: number;
      chunk_index?: number;
      excerpt?: string;
    }>;
  };
  additional_kwargs?: any;
  response_metadata?: any;
  tool_calls?: any[];
  invalid_tool_calls?: any[];
}

// Type for the AI response structure from n8n
interface N8nAiResponseContent {
  output: Array<{
    text: string;
    citations?: Array<{
      chunk_index: number;
      chunk_source_id: string;
      chunk_lines_from: number;
      chunk_lines_to: number;
    }>;
  }>;
}

const transformMessage = (item: any, sourceMap: Map<string, any>): EnhancedChatMessage => {
  // Handle the message format based on your JSON examples
  let transformedMessage: EnhancedChatMessage['message'];
  
  // Check if message is an object and has the expected structure
  if (item.message && 
      typeof item.message === 'object' && 
      !Array.isArray(item.message) &&
      'type' in item.message && 
      'content' in item.message) {
    
    // Type assertion with proper checking
    const messageObj = item.message as unknown as N8nMessageFormat;
    
    // Check if this is an AI message with JSON content that needs parsing
    if (messageObj.type === 'ai' && typeof messageObj.content === 'string') {
      try {
        const parsedContent = JSON.parse(messageObj.content) as N8nAiResponseContent;
        
        if (parsedContent.output && Array.isArray(parsedContent.output)) {
          // Transform the parsed content into segments and citations
          const segments: MessageSegment[] = [];
          const citations: Citation[] = [];
          let citationIdCounter = 1;
          
          parsedContent.output.forEach((outputItem) => {
            // Add the text segment
            segments.push({
              text: outputItem.text,
              citation_id: outputItem.citations && outputItem.citations.length > 0 ? citationIdCounter : undefined
            });
            
            // Process citations if they exist
            if (outputItem.citations && outputItem.citations.length > 0) {
              outputItem.citations.forEach((citation) => {
                const sourceInfo = sourceMap.get(citation.chunk_source_id);
                citations.push({
                  citation_id: citationIdCounter,
                  source_id: citation.chunk_source_id,
                  source_title: sourceInfo?.title || 'Unknown Source',
                  source_type: sourceInfo?.type || 'pdf',
                  chunk_lines_from: citation.chunk_lines_from,
                  chunk_lines_to: citation.chunk_lines_to,
                  chunk_index: citation.chunk_index,
                  excerpt: `Lines ${citation.chunk_lines_from}-${citation.chunk_lines_to}`
                });
              });
              citationIdCounter++;
            }
          });
          
          transformedMessage = {
            type: 'ai',
            content: {
              segments,
              citations
            },
            additional_kwargs: messageObj.additional_kwargs,
            response_metadata: messageObj.response_metadata,
            tool_calls: messageObj.tool_calls,
            invalid_tool_calls: messageObj.invalid_tool_calls
          };
        } else {
          // Fallback for AI messages that don't match expected format
          transformedMessage = {
            type: 'ai',
            content: messageObj.content,
            additional_kwargs: messageObj.additional_kwargs,
            response_metadata: messageObj.response_metadata,
            tool_calls: messageObj.tool_calls,
            invalid_tool_calls: messageObj.invalid_tool_calls
          };
        }
      } catch (parseError) {
        // If parsing fails, treat as regular string content
        transformedMessage = {
          type: 'ai',
          content: messageObj.content,
          additional_kwargs: messageObj.additional_kwargs,
          response_metadata: messageObj.response_metadata,
          tool_calls: messageObj.tool_calls,
          invalid_tool_calls: messageObj.invalid_tool_calls
        };
      }
    } else {
      // Handle non-AI messages or AI messages that don't need parsing
      transformedMessage = {
        type: messageObj.type === 'human' ? 'human' : 'ai',
        content: messageObj.content || 'Empty message',
        additional_kwargs: messageObj.additional_kwargs,
        response_metadata: messageObj.response_metadata,
        tool_calls: messageObj.tool_calls,
        invalid_tool_calls: messageObj.invalid_tool_calls
      };
    }
  } else if (typeof item.message === 'string') {
    // Handle case where message is just a string
    transformedMessage = {
      type: 'human',
      content: item.message
    };
  } else if (item.message === null || item.message === undefined) {
    // Handle null/undefined message
    console.warn('Message is null or undefined, using fallback');
    transformedMessage = {
      type: 'human',
      content: 'Empty message'
    };
  } else {
    // Fallback for any other cases - log the actual structure for debugging
    console.error('Unable to parse message, item structure:', {
      hasMessage: !!item.message,
      messageType: typeof item.message,
      messageIsArray: Array.isArray(item.message),
      messageKeys: item.message && typeof item.message === 'object' ? Object.keys(item.message) : 'N/A',
      fullItem: item
    });
    transformedMessage = {
      type: 'human',
      content: 'Unable to parse message'
    };
  }

  return {
    id: item.id,
    session_id: item.session_id,
    message: transformedMessage
  };
};

export const useChatMessages = (notebookId?: string, isPublic: boolean = false) => {
  const { user } = useAuth();
  const browserId = useBrowserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Load chat history for authenticated users, start fresh for public notebooks
  const {
    data: messages = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['chat-messages', notebookId, isPublic],
    queryFn: async () => {
      if (!notebookId) return [];

      // For public notebooks: use localStorage if not logged in, database if logged in
      if (isPublic) {
        // If user is logged in, use database (same as private notebooks)
        if (user?.id) {
          const compositeSessionId = `${notebookId}_${user.id}`;
          
          try {
            const { data: chatHistory, error: fetchError } = await supabase
              .from('n8n_chat_histories')
              .select('*')
              .eq('session_id', compositeSessionId)
              .order('id', { ascending: true }) as { data: any[] | null; error: any };

            if (fetchError) {
              console.error('Error fetching chat history:', fetchError);
              return [];
            }

            if (!chatHistory || chatHistory.length === 0) {
              return [];
            }

            const { data: sourcesData, error: sourcesError } = await supabase
              .from('sources')
              .select('id, title, type')
              .eq('notebook_id', notebookId);

            if (sourcesError) {
              console.error('Error fetching sources for message transformation:', sourcesError);
            }

            const sourceMap = new Map(sourcesData?.map(s => [s.id, s]) || []);

            const transformedMessages = chatHistory.map(item => transformMessage(item, sourceMap));
            return transformedMessages;
          } catch (error) {
            console.error('Error loading chat history:', error);
            return [];
          }
        }
        
        // If not logged in, use localStorage (no database queries)
        return loadFromLocalStorage(notebookId);
      }

      // For authenticated users, load existing chat history filtered by user
      try {
        if (!user?.id) {
          return [];
        }
        
        // Build composite session_id: notebookId_userId
        const compositeSessionId = `${notebookId}_${user.id}`;
        
        // Fetch messages for this notebook and user using composite session_id
        const { data: chatHistory, error: fetchError } = await supabase
          .from('n8n_chat_histories')
          .select('*')
          .eq('session_id', compositeSessionId)
          .order('id', { ascending: true }) as { data: any[] | null; error: any };

        if (fetchError) {
          console.error('Error fetching chat history:', fetchError);
          return [];
        }

        if (!chatHistory || chatHistory.length === 0) {
          return [];
        }

        // Fetch sources for proper transformation
        const { data: sourcesData, error: sourcesError } = await supabase
          .from('sources')
          .select('id, title, type')
          .eq('notebook_id', notebookId);

        if (sourcesError) {
          console.error('Error fetching sources for message transformation:', sourcesError);
        }

        const sourceMap = new Map(sourcesData?.map(s => [s.id, s]) || []);

        // Transform all messages (already filtered by user_id)
        const transformedMessages = chatHistory.map(item => transformMessage(item, sourceMap));
        
        return transformedMessages;
      } catch (error) {
        console.error('Error loading chat history:', error);
        return [];
      }
    },
    enabled: !!notebookId,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  // Set up Realtime subscription for new messages
  // For anonymous users, we still listen to Realtime but save to localStorage instead of DB
  useEffect(() => {
    if (!notebookId) return;

    // Build composite session_id for Realtime filter
    // For anonymous users, listen to messages with session_id = notebookId (n8n still saves them)
    // For authenticated users, listen to messages with session_id = notebookId_userId
    const compositeSessionId = user?.id
      ? `${notebookId}_${user.id}`
      : notebookId; // For anonymous users, n8n uses just notebookId as session_id
    
    const channel = supabase
      .channel(`chat-messages-${notebookId}-${user?.id || 'anon'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories',
          filter: `session_id=eq.${compositeSessionId}`
        },
        async (payload) => {
          try {
            // Fetch sources for proper transformation (needed for all messages)
            const { data: sourcesData, error: sourcesError } = await supabase
              .from('sources')
              .select('id, title, type')
              .eq('notebook_id', notebookId);
            
            if (sourcesError) {
              console.error('Error fetching sources for message transformation:', sourcesError);
            }
            
            const sourceMap = new Map(sourcesData?.map(s => [s.id, s]) || []);
            
            // Transform the new message
            const newMessage = transformMessage(payload.new, sourceMap);
            
            // Filter out system messages like "Workflow was started"
            const systemMessages = ['Workflow was started', 'workflow was started'];
            const isSystemMessage = (content: string): boolean => {
              const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
              return systemMessages.some(msg => contentStr.toLowerCase().includes(msg.toLowerCase()));
            };
            
            const messageContent = typeof newMessage.message.content === 'string' 
              ? newMessage.message.content 
              : JSON.stringify(newMessage.message.content);
            
            if (isSystemMessage(messageContent)) {
              return;
            }
            
            // For anonymous users, check if this message belongs to them
            // n8n might be saving with session_id = notebookId, so we need to filter
            if (isPublic && !user?.id) {
              const messageSessionId = (payload.new as any)?.session_id;
              // Only process if session_id matches notebookId exactly (not with user_id)
              if (messageSessionId !== notebookId) {
                return;
              }
            }
            
            // Update the query cache with the new message (unified logic for all cases)
            queryClient.setQueryData(['chat-messages', notebookId, isPublic], (oldMessages: EnhancedChatMessage[] = []) => {
              // Check if message already exists to prevent duplicates
              const messageExists = oldMessages.some(msg => {
                // Check by ID first
                if (msg.id === newMessage.id) {
                  return true;
                }
                
                // For user messages, also check by content (to catch duplicates from different sources)
                if (newMessage.message.type === 'human' && msg.message.type === 'human') {
                  const msgContent = typeof msg.message.content === 'string' ? msg.message.content : '';
                  const newMsgContent = typeof newMessage.message.content === 'string' ? newMessage.message.content : '';
                  
                  if (msgContent === newMsgContent && msgContent !== '') {
                    // If same content, check if one is temporary and the other is not
                    const msgIsTemp = String(msg.id).startsWith('temp-');
                    const newMsgIsTemp = String(newMessage.id).startsWith('temp-');
                    
                    // If one is temp and the other is not, they're the same message
                    if (msgIsTemp !== newMsgIsTemp) {
                      return true;
                    }
                    
                    // If both are real messages with same content, check timestamp
                    if (!msgIsTemp && !newMsgIsTemp) {
                      const timeDiff = Math.abs((msg.id as number) - (newMessage.id as number));
                      // If same content and within 5 seconds, consider it duplicate
                      if (timeDiff < 5000) {
                        return true;
                      }
                    }
                  }
                }
                
                return false;
              });
              
              if (messageExists) {
                return oldMessages;
              }
              
              // For anonymous users, replace temporary user messages with real ones from DB
              if (newMessage.message.type === 'human' && isPublic && !user?.id) {
                const tempMessageIndex = oldMessages.findIndex(msg => 
                  String(msg.id).startsWith('temp-') && 
                  msg.message.type === 'human' &&
                  typeof msg.message.content === 'string' &&
                  typeof newMessage.message.content === 'string' &&
                  msg.message.content === newMessage.message.content
                );
                
                if (tempMessageIndex !== -1) {
                  const updatedMessages = [...oldMessages];
                  updatedMessages[tempMessageIndex] = newMessage;
                  saveToLocalStorage(notebookId, updatedMessages);
                  return updatedMessages;
                }
              }
              
              const updatedMessages = [...oldMessages, newMessage];
              
              // For anonymous users, save to localStorage
              if (isPublic && !user?.id) {
                saveToLocalStorage(notebookId, updatedMessages);
              }
              
              return updatedMessages;
            });
          } catch (error) {
            console.error('Error processing realtime message:', error);
            console.error('Error details:', {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              payload: payload.new
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('Realtime subscription error:', err);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Channel error in Realtime subscription');
        } else if (status === 'TIMED_OUT') {
          console.error('Realtime subscription timed out');
        } else if (status === 'CLOSED') {
          console.warn('Realtime subscription closed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [notebookId, isPublic, user?.id, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (messageData: {
      notebookId: string;
      role: 'user' | 'assistant';
      content: string;
    }) => {
      // For anonymous public users, save user message to localStorage immediately
      // We use a temporary ID that will be replaced when the message comes from Realtime
      if (isPublic && !user?.id) {
        const tempId = `temp-${Date.now()}`;
        const userMessage: EnhancedChatMessage = {
          id: tempId as any, // Temporary ID to identify this message
          session_id: messageData.notebookId,
          message: {
            type: 'human',
            content: messageData.content
          }
        };
        
        queryClient.setQueryData(['chat-messages', notebookId, isPublic], (oldMessages: EnhancedChatMessage[] = []) => {
          const updatedMessages = [...oldMessages, userMessage];
          saveToLocalStorage(messageData.notebookId, updatedMessages);
          return updatedMessages;
        });
      }

      // Determine user_id:
      // - If user is logged in: use user_id (works for both private and public notebooks)
      // - If public notebook without user: null (don't save to DB)
      // - Otherwise: null
      const userId = user?.id || null;

      // For anonymous public users, don't send to webhook (they'll get response via polling or manual trigger)
      // Actually, we still need to send to webhook to get AI response, but we won't save it to DB
      // The webhook should handle this case and return the response directly
      const webhookResponse = await supabase.functions.invoke('send-chat-message', {
        body: {
          session_id: messageData.notebookId,
          message: messageData.content,
          user_id: userId, // null for anonymous users - webhook should not save to DB
          save_to_db: !!userId // Only save to DB if user is authenticated
        }
      });

      if (webhookResponse.error) {
        throw new Error(`Webhook error: ${webhookResponse.error.message}`);
      }

      // For anonymous users using In-Memory Chat Memory, process the response directly from webhook
      // (no Realtime events will be triggered since nothing is saved to DB)
      if (isPublic && !user?.id) {
        // The webhook response structure: { success: true, data: { ... } }
        // n8n returns the AI agent response in webhookResponse.data.data
        const webhookData = webhookResponse.data.data || webhookResponse.data;
        
        // Filter out system messages like "Workflow was started"
        const systemMessages = ['Workflow was started', 'workflow was started'];
        const isSystemMessage = (content: string): boolean => {
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          return systemMessages.some(msg => contentStr.toLowerCase().includes(msg.toLowerCase()));
        };
        
        // Check if the response is just a system message (workflow started but not finished)
        if (webhookData && webhookData.message) {
          const messageContent = typeof webhookData.message === 'string' 
            ? webhookData.message 
            : (webhookData.message.content || JSON.stringify(webhookData.message));
          if (isSystemMessage(messageContent)) {
            console.warn('Webhook returned system message "Workflow was started" instead of AI response.');
            console.warn('This means the workflow responded before the AI Agent finished processing.');
            console.warn('The workflow needs to wait for the AI Agent to complete before responding.');
            
            // For anonymous users, we can't wait for Realtime, so we need to poll or show an error
            // Since we can't poll easily, show a helpful error message
            queryClient.setQueryData(['chat-messages', notebookId, isPublic], (oldMessages: EnhancedChatMessage[] = []) => {
              const errorMessage: EnhancedChatMessage = {
                id: Date.now() + 1,
                session_id: messageData.notebookId,
                message: {
                  type: 'ai',
                  content: 'El workflow está respondiendo antes de que el asistente termine de procesar. Por favor, configura el workflow para que espere la respuesta del AI Agent antes de responder.'
                }
              };
              const updatedMessages = [...oldMessages, errorMessage];
              saveToLocalStorage(messageData.notebookId, updatedMessages);
              return updatedMessages;
            });
            return webhookResponse.data;
          }
        }
        
        // If there's no data, the webhook might not have returned the response yet
        if (!webhookData || 
            (typeof webhookData === 'object' && Object.keys(webhookData).length === 0)) {
          console.warn('Webhook returned empty or no data. The workflow might not be returning the AI response.');
          console.warn('For anonymous users, the workflow needs to return the AI Agent response directly.');
          
          queryClient.setQueryData(['chat-messages', notebookId, isPublic], (oldMessages: EnhancedChatMessage[] = []) => {
            const errorMessage: EnhancedChatMessage = {
              id: Date.now() + 1,
              session_id: messageData.notebookId,
              message: {
                type: 'ai',
                content: 'El workflow no devolvió una respuesta. Asegúrate de que el workflow espere la respuesta del AI Agent antes de responder.'
              }
            };
            const updatedMessages = [...oldMessages, errorMessage];
            saveToLocalStorage(messageData.notebookId, updatedMessages);
            return updatedMessages;
          });
          return webhookResponse.data;
        }
        
        // Fetch sources for proper transformation
        const { data: sourcesData } = await supabase
          .from('sources')
          .select('id, title, type')
          .eq('notebook_id', messageData.notebookId);
        
        const sourceMap = new Map(sourcesData?.map(s => [s.id, s]) || []);
        
        // Helper function to extract AI response from nested structures
        const extractAiResponse = (data: any): any => {
          // Check if it's already in the correct format
          if (data.message && data.message.type === 'ai') {
            return data.message;
          }
          
          // Check for structured output format: { output: [{ text: "...", citations: [...] }] }
          if (data.output && Array.isArray(data.output)) {
            // This is the structured output format from AI Agent with Output Parser
            // We need to convert it to the format that transformMessage expects
            // transformMessage expects: { type: 'ai', content: JSON.stringify({ output: [...] }) }
            const jsonContent = JSON.stringify({ output: data.output });
            return { 
              type: 'ai', 
              content: jsonContent
            };
          }
          
          // Check common AI Agent output fields
          if (data.text) {
            return { type: 'ai', content: data.text };
          }
          if (data.content) {
            return { type: 'ai', content: data.content };
          }
          if (data.response) {
            return { type: 'ai', content: data.response };
          }
          if (data.answer) {
            return { type: 'ai', content: data.answer };
          }
          
          // Check if it's an array (AI Agent might return array of outputs)
          if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            if (firstItem.output) {
              return { type: 'ai', content: JSON.stringify({ output: firstItem.output }) };
            }
            if (firstItem.text) {
              return { type: 'ai', content: firstItem.text };
            }
            if (typeof firstItem === 'string') {
              return { type: 'ai', content: firstItem };
            }
            // If it's an array of structured outputs
            return { type: 'ai', content: JSON.stringify({ output: data }) };
          }
          
          // If it's a direct string
          if (typeof data === 'string') {
            return { type: 'ai', content: data };
          }
          
          // Return the data itself and let transformMessage handle it
          return data;
        };
        
        // Transform the response (n8n returns the message in a format similar to DB messages)
        // The response might be in different formats depending on n8n configuration
        let aiResponse: EnhancedChatMessage | null = null;
        
        // Extract the AI message from the webhook data
        const extractedMessage = extractAiResponse(webhookData);
        
        // Check if it's a system message
        const messageContent = typeof extractedMessage === 'object' && extractedMessage.content
          ? (typeof extractedMessage.content === 'string' ? extractedMessage.content : JSON.stringify(extractedMessage.content))
          : (typeof extractedMessage === 'string' ? extractedMessage : JSON.stringify(extractedMessage));
        
        if (isSystemMessage(messageContent)) {
          return webhookResponse.data;
        }
        
        // Try to transform the message
        try {
          // If extractedMessage is already in the correct format with type 'ai'
          if (extractedMessage && extractedMessage.type === 'ai' && extractedMessage.content) {
            // If content is already a string (JSON stringified), use it directly
            // If content is an object/array, it needs to be stringified for transformMessage
            let contentToUse: string;
            if (typeof extractedMessage.content === 'string') {
              contentToUse = extractedMessage.content;
            } else if (Array.isArray(extractedMessage.content)) {
              // If content is an array, wrap it in { output: [...] } format
              contentToUse = JSON.stringify({ output: extractedMessage.content });
            } else {
              contentToUse = JSON.stringify(extractedMessage.content);
            }
            
            aiResponse = transformMessage({ 
              id: Date.now() + 1, 
              session_id: messageData.notebookId,
              message: {
                type: 'ai',
                content: contentToUse
              }
            }, sourceMap);
          } else if (typeof extractedMessage === 'string') {
            // Direct string response
            aiResponse = transformMessage({ 
              id: Date.now() + 1, 
              session_id: messageData.notebookId,
              message: {
                type: 'ai',
                content: extractedMessage
              }
            }, sourceMap);
          } else if (webhookData.message) {
            // Try with webhookData.message structure
            aiResponse = transformMessage({ 
              id: Date.now() + 1, 
              session_id: messageData.notebookId,
              message: webhookData.message
            }, sourceMap);
          } else if (webhookData.output && Array.isArray(webhookData.output)) {
            // Direct output array from webhook - convert to JSON string for transformMessage
            aiResponse = transformMessage({ 
              id: Date.now() + 1, 
              session_id: messageData.notebookId,
              message: {
                type: 'ai',
                content: JSON.stringify({ output: webhookData.output })
              }
            }, sourceMap);
          } else {
            // Try to transform the entire webhookData
            aiResponse = transformMessage({ 
              id: Date.now() + 1, 
              session_id: messageData.notebookId,
              message: extractedMessage
            }, sourceMap);
          }
          
          // Final check: don't save if it's a system message after transformation
          const finalContent = typeof aiResponse.message.content === 'string' 
            ? aiResponse.message.content 
            : JSON.stringify(aiResponse.message.content);
          if (isSystemMessage(finalContent)) {
            aiResponse = null;
          }
        } catch (error) {
          console.error('Error transforming webhook response:', error);
          console.error('Webhook data that failed:', JSON.stringify(webhookData, null, 2));
          // Create a fallback response
          aiResponse = {
            id: Date.now() + 1,
            session_id: messageData.notebookId,
            message: {
              type: 'ai',
              content: 'Lo siento, hubo un error al procesar la respuesta. Por favor, intenta de nuevo.'
            }
          };
        }
        
        // Save to localStorage and update cache if we have a valid response
        if (aiResponse) {
          queryClient.setQueryData(['chat-messages', notebookId, isPublic], (oldMessages: EnhancedChatMessage[] = []) => {
            const updatedMessages = [...oldMessages, aiResponse!];
            saveToLocalStorage(messageData.notebookId, updatedMessages);
            return updatedMessages;
          });
        } else {
          console.error('No valid AI response found in webhook data.');
          console.error('Webhook response structure:', JSON.stringify(webhookResponse.data, null, 2));
          console.error('This usually means the n8n workflow is not returning the AI Agent response.');
          console.error('For anonymous users, the workflow must return the AI Agent output directly.');
          
          // Show error message to user
          queryClient.setQueryData(['chat-messages', notebookId, isPublic], (oldMessages: EnhancedChatMessage[] = []) => {
            const errorMessage: EnhancedChatMessage = {
              id: Date.now() + 1,
              session_id: messageData.notebookId,
              message: {
                type: 'ai',
                content: 'Lo siento, no pude obtener una respuesta del asistente. Por favor, verifica la configuración del workflow.'
              }
            };
            const updatedMessages = [...oldMessages, errorMessage];
            saveToLocalStorage(messageData.notebookId, updatedMessages);
            return updatedMessages;
          });
        }
      }

      return webhookResponse.data;
    },
    onSuccess: () => {
      // For authenticated users, the response will appear via Realtime
      // For anonymous users, we handle it manually
    },
  });

  const deleteChatHistory = useMutation({
    mutationFn: async (notebookId: string) => {
      // For anonymous public users, clear localStorage
      if (isPublic && !user?.id) {
        clearLocalStorage(notebookId);
        queryClient.setQueryData(['chat-messages', notebookId, isPublic], []);
        return notebookId;
      }
      
      // For authenticated users, delete from database
      const compositeSessionId = user?.id
        ? `${notebookId}_${user.id}`
        : notebookId;
      
      const { error } = await supabase
        .from('n8n_chat_histories')
        .delete()
        .eq('session_id', compositeSessionId);

      if (error) {
        console.error('Error deleting chat history:', error);
        throw error;
      }
      
      return notebookId;
    },
    onSuccess: (notebookId) => {
      toast({
        title: "Historial de chat borrado",
        description: "Todos los mensajes han sido borrados correctamente.",
      });
      
      // Clear the query data and refetch to confirm
      queryClient.setQueryData(['chat-messages', notebookId], []);
      queryClient.invalidateQueries({
        queryKey: ['chat-messages', notebookId]
      });
    },
    onError: (error) => {
      console.error('Failed to delete chat history:', error);
      toast({
        title: "Error",
        description: "No se pudo borrar el historial de chat. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    }
  });

  return {
    messages,
    isLoading,
    error,
    sendMessage: sendMessage.mutate,
    sendMessageAsync: sendMessage.mutateAsync,
    isSending: sendMessage.isPending,
    deleteChatHistory: deleteChatHistory.mutate,
    isDeletingChatHistory: deleteChatHistory.isPending,
  };
};
