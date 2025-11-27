import { useState, useEffect } from 'react';

const BROWSER_ID_KEY = 'insights_lm_browser_id';

/**
 * Hook to get or generate a unique browser ID
 * This ID persists across sessions in the same browser
 */
export const useBrowserId = (): string | null => {
  const [browserId, setBrowserId] = useState<string | null>(null);

  useEffect(() => {
    // Try to get existing browser ID from localStorage
    let id = localStorage.getItem(BROWSER_ID_KEY);

    // If no ID exists, generate a new one
    if (!id) {
      // Generate a UUID-like string
      id = 'guest_' + crypto.randomUUID();
      localStorage.setItem(BROWSER_ID_KEY, id);
    }

    setBrowserId(id);
  }, []);

  return browserId;
};

/**
 * Get browser ID synchronously (for use outside React components)
 */
export const getBrowserId = (): string => {
  let id = localStorage.getItem(BROWSER_ID_KEY);
  
  if (!id) {
    id = 'guest_' + crypto.randomUUID();
    localStorage.setItem(BROWSER_ID_KEY, id);
  }
  
  return id;
};

