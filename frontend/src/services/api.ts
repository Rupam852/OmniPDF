const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Helper to generate request headers with optional auth token
 */
async function getHeaders(token?: string, isMultipart = false): Promise<Record<string, string>> {
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
  fileData?: string; // Base64 representation of processed PDF
  files?: { fileName: string; fileData: string; downloadUrl?: string; }[]; // Array of split parts
}

export const OmniPdfApi = {
  /**
   * Execute PDF Merge operation (handles multiple file uploads)
   */
  async mergePdfs(token: string, files: File[], onProgress?: (percent: number) => void): Promise<ToolResult> {
    const headers = await getHeaders(token, true);
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('files', file);
    });

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
  async summarizePdf(token: string, file: File, geminiKey?: string): Promise<ToolResult> {
    const headers = await getHeaders(token, true);
    if (geminiKey) {
      headers['x-gemini-key'] = geminiKey;
    }
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
  async translatePdf(token: string, file: File, targetLanguage: string, geminiKey?: string): Promise<ToolResult> {
    const headers = await getHeaders(token, true);
    if (geminiKey) {
      headers['x-gemini-key'] = geminiKey;
    }
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

  /**
   * Execute a generic PDF tool on the backend
   */
  async runPdfTool(
    endpoint: string,
    token: string,
    file: File,
    options: Record<string, any> = {}
  ): Promise<ToolResult> {
    const headers = await getHeaders(token, true);
    const formData = new FormData();
    formData.append('file', file);

    Object.keys(options).forEach((key) => {
      if (options[key] !== undefined) {
        formData.append(key, options[key]);
      }
    });

    const response = await fetch(`${API_BASE_URL}/tools/${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `${endpoint} operation failed`);
    }
    return data;
  },

  /**
   * Log tool usage database persistence
   */
  async logToolUsage(
    token: string,
    toolName: string,
    status = 'COMPLETED',
    processingTime?: number,
    errorMessage?: string
  ): Promise<{ success: boolean; logId: string }> {
    const headers = await getHeaders(token);
    const response = await fetch(`${API_BASE_URL}/tools/log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ toolName, status, processingTime, errorMessage }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to log tool usage');
    }
    return data;
  },
};
