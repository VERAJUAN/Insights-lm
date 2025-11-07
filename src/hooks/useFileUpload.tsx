
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  // PDF
  'pdf',
  // Text files
  'txt',
  // Markdown
  'md', 'markdown',
  // Audio files
  'mp3', 'wav', 'm4a', 'mp4', 'ogg', 'flac', 'aac', 'wma'
];

// Validate file extension
const isValidFileExtension = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  return ALLOWED_EXTENSIONS.includes(extension);
};

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File, notebookId: string, sourceId: string): Promise<string | null> => {
    try {
      setIsUploading(true);
      
      // Validate file extension before upload
      if (!isValidFileExtension(file.name)) {
        toast({
          title: "Archivo no permitido",
          description: `El archivo ${file.name} no tiene una extensión permitida. Tipos permitidos: PDF, txt, Markdown, Audio (mp3, wav, m4a, etc.)`,
          variant: "destructive",
        });
        return null;
      }
      
      // Get file extension
      const fileExtension = file.name.split('.').pop() || 'bin';
      
      // Create file path: sources/{notebook_id}/{source_id}.{extension}
      const filePath = `${notebookId}/${sourceId}.${fileExtension}`;
      
      console.log('Uploading file to:', filePath);
      
      // Upload file to Supabase storage
      const { data, error } = await supabase.storage
        .from('sources')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      console.log('File uploaded successfully:', data);
      return filePath;
    } catch (error) {
      console.error('File upload failed:', error);
      toast({
        title: "Upload Error",
        description: `Failed to upload ${file.name}. Please try again.`,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const getFileUrl = (filePath: string): string => {
    const { data } = supabase.storage
      .from('sources')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  };

  return {
    uploadFile,
    getFileUrl,
    isUploading,
  };
};
