import { useState, useEffect, useCallback } from 'react';
import { OmniPdfApi, ApiKeyStatus } from '../services/api';

/**
 * Custom React hook to manage Gemini API Key configuration state.
 * @param firebaseToken Firebase authentication user ID token
 */
export function useApiKeys(firebaseToken: string | null) {
  const [status, setStatus] = useState<ApiKeyStatus>({ isConfigured: false });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeyStatus = useCallback(async () => {
    if (!firebaseToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await OmniPdfApi.getApiKeyStatus(firebaseToken);
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch key configuration status.');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseToken]);

  const saveKey = useCallback(
    async (apiKey: string) => {
      if (!firebaseToken) {
        setError('Authentication required to save keys.');
        return false;
      }
      setIsLoading(true);
      setError(null);
      try {
        await OmniPdfApi.saveApiKey(firebaseToken, apiKey);
        await fetchKeyStatus(); // Refresh status
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to encrypt and save API key.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [firebaseToken, fetchKeyStatus]
  );

  const deleteKey = useCallback(async () => {
    if (!firebaseToken) {
      setError('Authentication required to delete keys.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await OmniPdfApi.deleteApiKey(firebaseToken);
      setStatus({ isConfigured: false });
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete key configuration.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [firebaseToken]);

  // Load key configuration on mount or when token updates
  useEffect(() => {
    if (firebaseToken) {
      fetchKeyStatus();
    } else {
      setStatus({ isConfigured: false });
    }
  }, [firebaseToken, fetchKeyStatus]);

  return {
    status,
    isLoading,
    error,
    saveKey,
    deleteKey,
    refreshStatus: fetchKeyStatus,
  };
}
