const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Helper to generate request headers with optional auth token
 */
async function getHeaders(token?: string, isMultipart = false): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export interface ApiKeyStatus {
  isConfigured: boolean;
  updatedAt?: string;
  keyMasked?: string;
}

export interface ToolResult {
  success: boolean;
  message?: string;
  downloadUrl?: string;
  downloadUrls?: string[];
  summary?: string;
  fileName?: string;
}

export const OmniPdfApi = {
  /**
   * Save Gemini API Key
   */
  async saveApiKey(token: string, apiKey: string): Promise<{ success: boolean; message: string }> {
    const headers = await getHeaders(token);
    const response = await fetch(`${API_BASE_URL}/keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ apiKey }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to save Gemini key');
    }
    return data;
  },

  /**
   * Fetch Gemini API Key Masked Status
   */
  async getApiKeyStatus(token: string): Promise<ApiKeyStatus> {
    const headers = await getHeaders(token);
    const response = await fetch(`${API_BASE_URL}/keys`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to check key status');
    }
    return data;
  },

  /**
   * Delete Gemini API Key Configuration
   */
  async deleteApiKey(token: string): Promise<{ success: boolean; message: string }> {
    const headers = await getHeaders(token);
    const response = await fetch(`${API_BASE_URL}/keys`, {
      method: 'DELETE',
      headers,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete key config');
    }
    return data;
  },

  /**
   * Execute PDF Merge operation (handles multiple file uploads)
   */
  async mergePdfs(token: string, files: File[], onProgress?: (percent: number) => void): Promise<ToolResult> {
    const headers = await getHeaders(token, true);
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('files', file);
    });

    // In production, you can wrap fetch in an XMLHttpRequest or custom upload hook to track progress.
    // Here we provide the standard fetch integration.
    const response = await fetch(`${API_BASE_URL}/tools/merge`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Merge operation failed');
    }
    return data;
  },

  /**
   * Execute AI Summarize operation
   */
  async summarizePdf(token: string, file: File): Promise<ToolResult> {
    const headers = await getHeaders(token, true);
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/tools/ai-summarizer`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'AI Summarizer failed. Make sure you set your Gemini Key.');
    }
    return data;
  },

  /**
   * Execute Translate PDF operation
   */
  async translatePdf(token: string, file: File, targetLanguage: string): Promise<ToolResult> {
    const headers = await getHeaders(token, true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);

    const response = await fetch(`${API_BASE_URL}/tools/translate`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'PDF Translation failed');
    }
    return data;
  },
};
