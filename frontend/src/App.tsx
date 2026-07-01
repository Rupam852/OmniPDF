import { useState, useEffect, useCallback } from 'react';
import { FileUploadZone } from './components/FileUploadZone';
import { OmniPdfApi } from './services/api';
import { compressPdfInBrowser } from './services/compressPdf';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  exiting?: boolean;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'organize' | 'optimize' | 'convert_to' | 'convert_from' | 'edit' | 'security' | 'intelligence' | 'workflow';
  iconColor: string;
  iconPath: JSX.Element;
}

export default function App() {
  const [showLandingPage, setShowLandingPage] = useState<boolean>(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [openDropdown, setOpenDropdown] = useState<'convert' | 'alltools' | null>(null);
  const [landingCategory, setLandingCategory] = useState<string>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // ── Toast Notification System ────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);
  let toastCounter = 0;

  const showToast = useCallback((type: ToastType, title: string, message = '') => {
    const id = Date.now() + toastCounter++;
    setToasts(prev => [...prev, { id, type, title, message }]);
    // Auto-remove after 4.3s (4s progress + 0.3s exit animation)
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
  }, []);

  const toastIcons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'i',
  };
  const toastTitles: Record<ToastType, string> = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  };

  // Dedicated state for processed results to render the success/download page
  const [processedResult, setProcessedResult] = useState<{
    toolName: string;
    fileName: string;
    successMessage: string;
    actionText: string;
    downloadUrl?: string;
    summary?: string;
    fileNameToDownload?: string;
    files?: { fileName: string; downloadUrl: string; }[];
  } | null>(null);

  // Force-close dropdowns on tool click
  const closeDropdowns = () => setOpenDropdown(null);

  const tabs = [
    'All',
    'Workflows',
    'Organize PDF',
    'Optimize PDF',
    'Convert to PDF',
    'Convert from PDF',
    'Edit PDF',
    'PDF Security',
    'PDF Intelligence'
  ];

  const tools: Tool[] = [
    // Organize PDF
    {
      id: 'merge',
      name: 'Merge PDF',
      description: 'Combine PDFs in the order you want with the easiest PDF merger available.',
      category: 'organize',
      iconColor: '#f97316',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    },
    {
      id: 'split',
      name: 'Split PDF',
      description: 'Separate one page or a whole set for easy conversion into independent PDF files.',
      category: 'organize',
      iconColor: '#f97316',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 14h18M3 10h18" />
        </svg>
      )
    },
    {
      id: 'remove-pages',
      name: 'Remove Pages',
      description: 'Delete PDF pages from your file to keep only what you need.',
      category: 'organize',
      iconColor: '#f97316',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
      )
    },
    {
      id: 'extract-pages',
      name: 'Extract Pages',
      description: 'Extract specific pages from your PDF file and save them as a new document.',
      category: 'organize',
      iconColor: '#f97316',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z" />
        </svg>
      )
    },
    {
      id: 'organize-pdf',
      name: 'Organize PDF',
      description: 'Sort pages of your PDF file however you like. Delete PDF pages or add PDF pages.',
      category: 'organize',
      iconColor: '#f97316',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      )
    },
    {
      id: 'scan-to-pdf',
      name: 'Scan to PDF',
      description: 'Capture document scans from your mobile device and send them instantly to your browser.',
      category: 'organize',
      iconColor: '#f97316',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      )
    },
    // Optimize PDF
    {
      id: 'compress',
      name: 'Compress PDF',
      description: 'Reduce file size while optimizing for maximal PDF quality.',
      category: 'optimize',
      iconColor: '#22c55e',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 14h16M12 3v7M12 21v-7" />
        </svg>
      )
    },
    {
      id: 'repair',
      name: 'Repair PDF',
      description: 'Repair a damaged PDF and recover data from corrupt PDF. Fix PDF files.',
      category: 'optimize',
      iconColor: '#22c55e',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      )
    },
    {
      id: 'ocr',
      name: 'OCR PDF',
      description: 'Convert scanned PDF to searchable, selectable text using Gemini 1.5 Flash AI. (Requires Gemini API Key)',
      category: 'optimize',
      iconColor: '#22c55e',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7V4h3M17 4h3v3M4 17v3h3M17 20h3v-3M9 10h6M9 14h6" />
        </svg>
      )
    },
    // Convert To PDF
    {
      id: 'jpg-to-pdf',
      name: 'JPG to PDF',
      description: 'Convert JPG images to PDF in seconds. Easily adjust orientation and margins.',
      category: 'convert_to',
      iconColor: '#eab308',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    },
    {
      id: 'word-to-pdf',
      name: 'Word to PDF',
      description: 'Make DOC and DOCX files easy to read by converting them to PDF.',
      category: 'convert_to',
      iconColor: '#2563eb',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="12" y2="17" />
        </svg>
      )
    },
    {
      id: 'powerpoint-to-pdf',
      name: 'PowerPoint to PDF',
      description: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.',
      category: 'convert_to',
      iconColor: '#ea580c',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M9 17V7l7 5-7 5z" />
        </svg>
      )
    },
    {
      id: 'excel-to-pdf',
      name: 'Excel to PDF',
      description: 'Make EXCEL spreadsheets easy to read by converting them to PDF.',
      category: 'convert_to',
      iconColor: '#16a34a',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      )
    },
    {
      id: 'html-to-pdf',
      name: 'HTML to PDF',
      description: 'Convert webpages in HTML to PDF. Copy and paste the URL of the page you want.',
      category: 'convert_to',
      iconColor: '#ca8a04',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      )
    },
    // Convert From PDF
    {
      id: 'pdf-to-jpg',
      name: 'PDF to JPG',
      description: 'Convert each PDF page into a JPG or extract all images contained in a PDF.',
      category: 'convert_from',
      iconColor: '#eab308',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
          <circle cx="18.5" cy="5.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    },
    {
      id: 'pdf-to-word',
      name: 'PDF to Word',
      description: 'Easily convert your PDF files into easy to edit DOC and DOCX documents.',
      category: 'convert_from',
      iconColor: '#3b82f6',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <text x="7" y="17" fontSize="8" fontWeight="bold" fill="currentColor">W</text>
        </svg>
      )
    },
    {
      id: 'pdf-to-powerpoint',
      name: 'PDF to PowerPoint',
      description: 'Turn your PDF files into easy to edit PPT and PPTX slideshows.',
      category: 'convert_from',
      iconColor: '#ea580c',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <text x="7" y="17" fontSize="8" fontWeight="bold" fill="currentColor">P</text>
        </svg>
      )
    },
    {
      id: 'pdf-to-excel',
      name: 'PDF to Excel',
      description: 'Pull data straight from PDFs into Excel spreadsheets in a few short seconds.',
      category: 'convert_from',
      iconColor: '#16a34a',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <text x="7" y="17" fontSize="8" fontWeight="bold" fill="currentColor">X</text>
        </svg>
      )
    },
    {
      id: 'pdf-to-pdfa',
      name: 'PDF to PDF/A',
      description: 'Transform your PDF to PDF/A, the ISO-standardized version of PDF for long-term archiving.',
      category: 'convert_from',
      iconColor: '#1d4ed8',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <rect x="7" y="11" width="10" height="7" rx="1" />
        </svg>
      )
    },
    // Edit PDF
    {
      id: 'rotate',
      name: 'Rotate PDF',
      description: 'Rotate your PDFs the way you need them. You can even rotate multiple PDFs at once!',
      category: 'edit',
      iconColor: '#a855f7',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
      )
    },
    {
      id: 'page-numbers',
      name: 'Page Numbers',
      description: 'Add page numbers into PDFs with ease. Choose your positions, dimensions, typography.',
      category: 'edit',
      iconColor: '#a855f7',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M10 9h2v6M8 15h6" />
        </svg>
      )
    },
    {
      id: 'watermark',
      name: 'Watermark',
      description: 'Stamp an image or text over your PDF in seconds. Choose the typography and position.',
      category: 'edit',
      iconColor: '#a855f7',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    },
    {
      id: 'crop',
      name: 'Crop PDF',
      description: 'Crop margins of PDF documents or select specific areas, then apply changes.',
      category: 'edit',
      iconColor: '#a855f7',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 1v17h17M1 6h17v17" />
        </svg>
      )
    },
    {
      id: 'pdf-forms',
      name: 'PDF Forms',
      description: 'Detect form fields automatically, create interactive fillable PDFs, or fill forms.',
      category: 'edit',
      iconColor: '#a855f7',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="8" y1="8" x2="16" y2="8" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="16" x2="12" y2="16" />
        </svg>
      )
    },
    // PDF Security
    {
      id: 'unlock',
      name: 'Unlock PDF',
      description: 'Remove PDF password security, giving you the freedom to use your PDFs as you want.',
      category: 'security',
      iconColor: '#1e40af',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      )
    },
    {
      id: 'protect',
      name: 'Protect PDF',
      description: 'Protect PDF files with a password. Encrypt PDF documents to prevent unauthorized access.',
      category: 'security',
      iconColor: '#1e40af',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    },
    {
      id: 'sign',
      name: 'Sign PDF',
      description: 'Sign yourself or request electronic signatures from others.',
      category: 'security',
      iconColor: '#1e40af',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 20H4M20 4c-.88 0-1.72.35-2.34.98L7 15l-3 4 4-3 10.02-10.02C18.65 5.36 19 4.7 19 4a1 1 0 0 0-1-1Z" />
        </svg>
      )
    },
    {
      id: 'redact',
      name: 'Redact PDF',
      description: 'Redact text and graphics to permanently remove sensitive information from a PDF.',
      category: 'security',
      iconColor: '#1e40af',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="6" y1="12" x2="18" y2="12" />
        </svg>
      )
    },
    {
      id: 'compare',
      name: 'Compare PDF',
      description: 'Show a side-by-side document comparison and easily spot changes between different versions.',
      category: 'security',
      iconColor: '#1e40af',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="9" height="18" rx="1" />
          <rect x="13" y="3" width="9" height="18" rx="1" />
        </svg>
      )
    },
    // PDF Intelligence
    {
      id: 'ai-summarizer',
      name: 'AI Summarizer',
      description: 'Quickly generate concise summaries from articles, paragraphs, and essays using Gemini.',
      category: 'intelligence',
      iconColor: '#6366f1',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    }
  ];

  // Sync selectedTool and processedResult with URL hash for persistent routes & back-button gesture support
  useEffect(() => {
    if (selectedTool) {
      const targetHash = processedResult ? `${selectedTool.id}-success` : selectedTool.id;
      if (window.location.hash !== `#${targetHash}`) {
        window.location.hash = targetHash;
      }
    } else {
      if (window.location.hash !== '') {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    }
  }, [selectedTool, processedResult]);

  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash.replace('#', '');
      if (!currentHash) {
        setSelectedTool(null);
        setProcessedResult(null);
      } else {
        const isSuccess = currentHash.endsWith('-success');
        const toolId = isSuccess ? currentHash.slice(0, -8) : currentHash;
        const matched = tools.find(t => t.id === toolId);
        
        if (matched) {
          setSelectedTool(matched);
          if (!isSuccess) {
            setProcessedResult(null);
          }
        } else {
          setSelectedTool(null);
          setProcessedResult(null);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Auto-close any open dropdown whenever the selected tool or page changes
  useEffect(() => {
    setOpenDropdown(null);
  }, [selectedTool, showLandingPage]);

  const filteredTools = tools.filter(tool => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Workflows') return tool.category === 'workflow';
    if (activeTab === 'Organize PDF') return tool.category === 'organize';
    if (activeTab === 'Optimize PDF') return tool.category === 'optimize';
    if (activeTab === 'Convert to PDF') return tool.category === 'convert_to';
    if (activeTab === 'Convert from PDF') return tool.category === 'convert_from';
    if (activeTab === 'Edit PDF') return tool.category === 'edit';
    if (activeTab === 'PDF Security') return tool.category === 'security';
    if (activeTab === 'PDF Intelligence') return tool.category === 'intelligence';
    return true;
  });

  const handleProcessTool = async (files: File[], options: Record<string, any>) => {
    if (!selectedTool) return;

    // Tools that are shown in UI but require external binaries — handle gracefully
    const NOT_IMPLEMENTED_TOOLS: string[] = [];

    if (NOT_IMPLEMENTED_TOOLS.includes(selectedTool.id)) {
      showToast('warning', 'Coming Soon', `"${selectedTool.name}" requires an external server component not yet installed.`);
      throw new Error('Tool not yet implemented on this server.');
    }

    try {

      // Helper: base64 → Blob URL
      const base64ToBlobUrl = (base64: string, mimeType = 'application/pdf'): string => {
        const byteCharacters = atob(base64);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: mimeType });
        return URL.createObjectURL(blob);
      };

      // Helper: build a download filename
      const makeFileName = (originalName: string, suffix: string): string => {
        const dotIndex = originalName.lastIndexOf('.');
        const base = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
        const ext  = dotIndex !== -1 ? originalName.substring(dotIndex)   : '.pdf';
        return `${base}${suffix}${ext}`;
      };

      // ── MERGE ────────────────────────────────────────────────────────────────
      if (selectedTool.id === 'merge') {
        const result = await OmniPdfApi.mergePdfs('', files);
        if (result.fileData) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files.map(f => f.name).join(', '),
            downloadUrl: base64ToBlobUrl(result.fileData),
            successMessage: result.message || 'Your PDF files have been merged successfully!',
            actionText: 'Download Merged PDF',
            fileNameToDownload: result.fileName || `merged_${Date.now()}.pdf`,
          });
        }
      }

      // ── SPLIT ────────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'split') {
        const result = await OmniPdfApi.runPdfTool('split', '', files[0], {
          splitMode: options.splitMode || 'all',
          pageRanges: options.pageRanges || '',
        });
        if (result.files && result.files.length > 0) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            files: result.files.map(f => ({ fileName: f.fileName, downloadUrl: base64ToBlobUrl(f.fileData) })),
            successMessage: result.message || 'Your PDF has been split successfully!',
            actionText: 'Download Split PDFs',
          });
        }
      }

      // ── COMPRESS ─────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'compress') {
        const compressedList: { fileName: string; downloadUrl: string }[] = [];
        let totalOriginal = 0;
        let totalCompressed = 0;

        for (const file of files) {
          const result = await compressPdfInBrowser(
            file,
            options.targetSize || 500,
            options.targetUnit || 'KB'
          );
          const blob = new Blob([result.bytes as any], { type: 'application/pdf' });
          const downloadUrl = URL.createObjectURL(blob);
          
          compressedList.push({
            fileName: makeFileName(file.name, '_compressed'),
            downloadUrl: downloadUrl,
          });

          totalOriginal += result.originalSize;
          totalCompressed += result.compressedSize;
        }

        const reductionPct = (((totalOriginal - totalCompressed) / totalOriginal) * 100).toFixed(1);

        if (compressedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: compressedList[0].downloadUrl,
            successMessage: `PDF compressed successfully! Reduced from ${(totalOriginal / 1024).toFixed(1)} KB → ${(totalCompressed / 1024).toFixed(1)} KB (${reductionPct}% reduction).`,
            actionText: 'Download Compressed PDF',
            fileNameToDownload: compressedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: compressedList,
            successMessage: `Successfully compressed ${files.length} PDFs! Total reduction: ${(totalOriginal / 1024).toFixed(1)} KB → ${(totalCompressed / 1024).toFixed(1)} KB (${reductionPct}% reduction).`,
            actionText: 'Download Compressed PDFs',
          });
        }
      }

      // ── PROTECT ──────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'protect') {
        const protectedList: { fileName: string; downloadUrl: string }[] = [];
        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('protect', '', file, {
            password: options.password || '',
          });
          if (result.fileData) {
            protectedList.push({
              fileName: makeFileName(file.name, '_protected'),
              downloadUrl: base64ToBlobUrl(result.fileData),
            });
          }
        }

        if (protectedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: protectedList[0].downloadUrl,
            successMessage: 'PDF protected with security stamp successfully!',
            actionText: 'Download Protected PDF',
            fileNameToDownload: protectedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: protectedList,
            successMessage: `Successfully protected ${files.length} PDFs with security stamp!`,
            actionText: 'Download Protected PDFs',
          });
        }
      }

      // ── ROTATE ───────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'rotate') {
        const rotatedList: { fileName: string; downloadUrl: string }[] = [];
        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('rotate', '', file, {
            angle: options.angle || '90',
            pages: options.pages || 'all',
          });
          if (result.fileData) {
            rotatedList.push({
              fileName: makeFileName(file.name, '_rotated'),
              downloadUrl: base64ToBlobUrl(result.fileData),
            });
          }
        }

        if (rotatedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: rotatedList[0].downloadUrl,
            successMessage: 'PDF pages rotated successfully!',
            actionText: 'Download Rotated PDF',
            fileNameToDownload: rotatedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: rotatedList,
            successMessage: `Successfully rotated pages of ${files.length} PDFs!`,
            actionText: 'Download Rotated PDFs',
          });
        }
      }

      // ── WATERMARK ─────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'watermark') {
        const watermarkedList: { fileName: string; downloadUrl: string }[] = [];
        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('watermark', '', file, {
            watermarkText: options.watermarkText || 'OmniPDF',
            opacity: options.opacity || '0.15',
            fontSize: options.watermarkFontSize || '40',
            position: options.position || 'center',
          });
          if (result.fileData) {
            watermarkedList.push({
              fileName: makeFileName(file.name, '_watermarked'),
              downloadUrl: base64ToBlobUrl(result.fileData),
            });
          }
        }

        if (watermarkedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: watermarkedList[0].downloadUrl,
            successMessage: 'Watermark applied successfully!',
            actionText: 'Download Watermarked PDF',
            fileNameToDownload: watermarkedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: watermarkedList,
            successMessage: `Successfully watermarked ${files.length} PDFs!`,
            actionText: 'Download Watermarked PDFs',
          });
        }
      }

      // ── REMOVE PAGES ─────────────────────────────────────────────────────────
      else if (selectedTool.id === 'remove-pages') {
        const processedList: { fileName: string; downloadUrl: string }[] = [];
        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('remove-pages', '', file, {
            pageNumbers: options.pageNumbers || '',
          });
          if (result.fileData) {
            processedList.push({
              fileName: makeFileName(file.name, '_pages_removed'),
              downloadUrl: base64ToBlobUrl(result.fileData),
            });
          }
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: processedList[0].downloadUrl,
            successMessage: 'Pages removed successfully!',
            actionText: 'Download PDF',
            fileNameToDownload: processedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: processedList,
            successMessage: `Successfully removed pages from ${files.length} PDFs!`,
            actionText: 'Download PDFs',
          });
        }
      }

      // ── EXTRACT PAGES ────────────────────────────────────────────────────────
      else if (selectedTool.id === 'extract-pages') {
        const processedList: { fileName: string; downloadUrl: string }[] = [];
        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('extract-pages', '', file, {
            pageRanges: options.pageRanges || '',
          });
          if (result.fileData) {
            processedList.push({
              fileName: makeFileName(file.name, '_extracted'),
              downloadUrl: base64ToBlobUrl(result.fileData),
            });
          }
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: processedList[0].downloadUrl,
            successMessage: 'Pages extracted successfully!',
            actionText: 'Download Extracted PDF',
            fileNameToDownload: processedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: processedList,
            successMessage: `Successfully extracted pages from ${files.length} PDFs!`,
            actionText: 'Download Extracted PDFs',
          });
        }
      }

      // ── ORGANIZE PDF ─────────────────────────────────────────────────────────
      else if (selectedTool.id === 'organize-pdf') {
        const result = await OmniPdfApi.runPdfTool('organize-pdf', '', files[0], {
          pageOrder: options.pageOrder || '',
        });
        if (result.fileData) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: base64ToBlobUrl(result.fileData),
            successMessage: result.message || 'PDF pages reorganized successfully!',
            actionText: 'Download Organized PDF',
            fileNameToDownload: makeFileName(files[0].name, '_organized'),
          });
        }
      }

      // ── PAGE NUMBERS ─────────────────────────────────────────────────────────
      else if (selectedTool.id === 'page-numbers') {
        const processedList: { fileName: string; downloadUrl: string }[] = [];
        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('page-numbers', '', file, {
            position: options.position || 'bottom-center',
            startNumber: options.startNumber || '1',
            prefix: options.prefix || '',
            fontSize: options.pgNumFontSize || '10',
          });
          if (result.fileData) {
            processedList.push({
              fileName: makeFileName(file.name, '_numbered'),
              downloadUrl: base64ToBlobUrl(result.fileData),
            });
          }
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: processedList[0].downloadUrl,
            successMessage: 'Page numbers added successfully!',
            actionText: 'Download PDF with Page Numbers',
            fileNameToDownload: processedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: processedList,
            successMessage: `Successfully added page numbers to ${files.length} PDFs!`,
            actionText: 'Download Numbered PDFs',
          });
        }
      }

      // ── REPAIR ───────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'repair') {
        const processedList: { fileName: string; downloadUrl: string }[] = [];
        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('repair', '', file);
          if (result.fileData) {
            processedList.push({
              fileName: makeFileName(file.name, '_repaired'),
              downloadUrl: base64ToBlobUrl(result.fileData),
            });
          }
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: processedList[0].downloadUrl,
            successMessage: 'PDF repaired successfully!',
            actionText: 'Download Repaired PDF',
            fileNameToDownload: processedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: processedList,
            successMessage: `Successfully repaired ${files.length} PDFs!`,
            actionText: 'Download Repaired PDFs',
          });
        }
      }

      // ── UNLOCK ───────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'unlock') {
        const processedList: { fileName: string; downloadUrl: string }[] = [];
        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('unlock', '', file, {
            password: options.password || '',
          });
          if (result.fileData) {
            processedList.push({
              fileName: makeFileName(file.name, '_unlocked'),
              downloadUrl: base64ToBlobUrl(result.fileData),
            });
          }
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: processedList[0].downloadUrl,
            successMessage: 'PDF unlocked successfully!',
            actionText: 'Download Unlocked PDF',
            fileNameToDownload: processedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: processedList,
            successMessage: `Successfully unlocked ${files.length} PDFs!`,
            actionText: 'Download Unlocked PDFs',
          });
        }
      }

      // ── JPG TO PDF ───────────────────────────────────────────────────────────
      else if (selectedTool.id === 'jpg-to-pdf') {
        const result = await OmniPdfApi.mergeImages('', files);
        if (result.fileData) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files.map(f => f.name).join(', '),
            downloadUrl: base64ToBlobUrl(result.fileData),
            successMessage: result.message || 'Images converted to PDF!',
            actionText: 'Download PDF',
            fileNameToDownload: result.fileName || `images_to_pdf_${Date.now()}.pdf`,
          });
        }
      }

      // ── SCAN TO PDF ───────────────────────────────────────────────────────────
      else if (selectedTool.id === 'scan-to-pdf') {
        const result = await OmniPdfApi.mergeImages('', files);
        if (result.fileData) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files.map(f => f.name).join(', '),
            downloadUrl: base64ToBlobUrl(result.fileData),
            successMessage: result.message || 'Scanned pages compiled to PDF successfully!',
            actionText: 'Download Scanned PDF',
            fileNameToDownload: result.fileName || `scanned_${Date.now()}.pdf`,
          });
        }
      }

      // ── PDF TO JPG ───────────────────────────────────────────────────────────
      else if (selectedTool.id === 'pdf-to-jpg') {
        const processedList: { fileName: string; downloadUrl: string }[] = [];
        const base64ToZipBlobUrl = (base64: string): string => {
          const byteCharacters = atob(base64);
          const byteArray = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: 'application/zip' });
          return URL.createObjectURL(blob);
        };

        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool('pdf-to-jpg', '', file);
          if (result.fileData) {
            processedList.push({
              fileName: result.fileName || `${file.name.replace(/\.[^/.]+$/, '')}_images.zip`,
              downloadUrl: base64ToZipBlobUrl(result.fileData),
            });
          }
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: processedList[0].downloadUrl,
            successMessage: 'PDF pages converted to JPEG successfully!',
            actionText: 'Download ZIP Archive',
            fileNameToDownload: processedList[0].fileName,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            files: processedList,
            successMessage: `Successfully converted pages of ${files.length} PDFs to JPEG archives!`,
            actionText: 'Download ZIP Archives',
          });
        }
      }

      // ── AI SUMMARIZER ─────────────────────────────────────────────────────────
      else if (selectedTool.id === 'ai-summarizer') {
        const processedList: { fileName: string; downloadUrl?: string }[] = [];
        const summaries: string[] = [];

        for (const file of files) {
          const result = await OmniPdfApi.summarizePdf('', file, options.geminiKey, options.summaryFormat);
          summaries.push(`--- SUMMARY FOR ${file.name} ---\n${result.summary || ''}`);
          processedList.push({
            fileName: result.fileName || `summary_${file.name}.pdf`,
            downloadUrl: result.fileData ? base64ToBlobUrl(result.fileData) : undefined,
          });
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            summary: summaries[0].replace(/--- SUMMARY FOR .* ---\n/, ''),
            downloadUrl: processedList[0].downloadUrl,
            fileNameToDownload: processedList[0].fileName,
            successMessage: 'Your PDF has been summarized with Gemini AI!',
            actionText: 'Download Summary PDF',
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            summary: summaries.join('\n\n'),
            files: processedList as { fileName: string; downloadUrl: string }[],
            successMessage: `Successfully summarized ${files.length} PDFs with Gemini AI!`,
            actionText: 'Download Summary PDFs',
          });
        }
      }

      // ── OCR PDF ──────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'ocr') {
        const processedList: { fileName: string; downloadUrl?: string }[] = [];
        const summaries: string[] = [];

        for (const file of files) {
          const result = await OmniPdfApi.ocrPdf('', file, options.geminiKey);
          summaries.push(`--- OCR TEXT FOR ${file.name} ---\n${result.summary || ''}`);
          processedList.push({
            fileName: result.fileName || `ocr_${file.name}`,
            downloadUrl: result.fileData ? base64ToBlobUrl(result.fileData) : undefined,
          });
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            summary: summaries[0].replace(/--- OCR TEXT FOR .* ---\n/, ''),
            downloadUrl: processedList[0].downloadUrl,
            fileNameToDownload: processedList[0].fileName,
            successMessage: 'Your PDF has been OCR-processed with Gemini AI!',
            actionText: 'Download OCR PDF',
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} PDFs`,
            summary: summaries.join('\n\n'),
            files: processedList as { fileName: string; downloadUrl: string }[],
            successMessage: `Successfully OCR-processed ${files.length} PDFs with Gemini AI!`,
            actionText: 'Download OCR PDFs',
          });
        }
      }

      // ── COMPARE ──────────────────────────────────────────────────────────────
      else if (selectedTool.id === 'compare') {
        if (files.length < 2) {
          showToast('warning', 'Two Files Required', 'Please upload exactly two PDF files to compare.');
          throw new Error('Two files are required for comparison.');
        }
        const result = await OmniPdfApi.comparePdfs('', files[0], files[1]);
        setProcessedResult({
          toolName: selectedTool.name,
          fileName: 'Comparison Report',
          downloadUrl: result.fileData ? base64ToBlobUrl(result.fileData) : undefined,
          fileNameToDownload: result.fileName || 'comparison_report.pdf',
          successMessage: 'Your PDF comparison report has been generated successfully!',
          actionText: 'Download Comparison Report',
        });
      }

      // ── GENERIC PYTHON RUNNER TOOLS ──────────────────────────────────────────
      else if (['word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf', 'pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel', 'pdf-to-pdfa', 'crop', 'pdf-forms', 'sign', 'redact'].includes(selectedTool.id)) {
        const endpoint = selectedTool.id;
        
        // Map clean output suffixes and mime types
        const suffixMap: Record<string, { suffix: string, mime: string, action: string, msg: string }> = {
          'word-to-pdf': { suffix: '.pdf', mime: 'application/pdf', action: 'Download PDF', msg: 'Document converted to PDF successfully!' },
          'powerpoint-to-pdf': { suffix: '.pdf', mime: 'application/pdf', action: 'Download PDF', msg: 'Presentation converted to PDF successfully!' },
          'excel-to-pdf': { suffix: '.pdf', mime: 'application/pdf', action: 'Download PDF', msg: 'Spreadsheet converted to PDF successfully!' },
          'html-to-pdf': { suffix: '.pdf', mime: 'application/pdf', action: 'Download PDF', msg: 'HTML converted to PDF successfully!' },
          'pdf-to-word': { suffix: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', action: 'Download Word Doc', msg: 'PDF converted to Word successfully!' },
          'pdf-to-powerpoint': { suffix: '.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', action: 'Download PowerPoint', msg: 'PDF converted to PowerPoint successfully!' },
          'pdf-to-excel': { suffix: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', action: 'Download Excel Workbook', msg: 'PDF converted to Excel successfully!' },
          'pdf-to-pdfa': { suffix: '.pdf', mime: 'application/pdf', action: 'Download PDF/A', msg: 'PDF converted to PDF/A archive successfully!' },
          'crop': { suffix: '.pdf', mime: 'application/pdf', action: 'Download Cropped PDF', msg: 'PDF margins cropped successfully!' },
          'pdf-forms': { suffix: '.pdf', mime: 'application/pdf', action: 'Download Flattened PDF', msg: 'Interactive PDF form fields flattened successfully!' },
          'sign': { suffix: '.pdf', mime: 'application/pdf', action: 'Download Signed PDF', msg: 'PDF signed successfully!' },
          'redact': { suffix: '.pdf', mime: 'application/pdf', action: 'Download Redacted PDF', msg: 'Selected text has been permanently redacted!' },
        };

        const config = suffixMap[selectedTool.id];
        const processedList: { fileName: string; downloadUrl: string }[] = [];

        for (const file of files) {
          const result = await OmniPdfApi.runPdfTool(endpoint, '', file, options);
          if (result.fileData) {
            processedList.push({
              fileName: result.fileName || makeFileName(file.name, `_processed${config.suffix}`),
              downloadUrl: base64ToBlobUrl(result.fileData, config.mime),
            });
          }
        }

        if (processedList.length === 1) {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: processedList[0].downloadUrl,
            fileNameToDownload: processedList[0].fileName,
            successMessage: config.msg,
            actionText: config.action,
          });
        } else {
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: `${files.length} Files`,
            files: processedList,
            successMessage: `Successfully processed ${files.length} files!`,
            actionText: `Download Processed Files`,
          });
        }
      }

      // ── FALLBACK ─────────────────────────────────────────────────────────────
      else {
        showToast('warning', 'Coming Soon', `"${selectedTool.name}" is not yet supported. Stay tuned!`);
        throw new Error(`No handler for tool: ${selectedTool.id}`);
      }

    } catch (err: any) {
      const msg = err.message || String(err);
      // Don't show a second toast if we already showed one (re-throw from above)
      if (!msg.includes('not yet implemented') && !msg.includes('No handler') && !msg.includes('Two files')) {
        showToast('error', 'Operation Failed', msg);
      }
      throw err;
    }
  };

  const renderSuccessBigPreview = (url: string, fileName: string) => {
    const dotIndex = fileName.lastIndexOf('.');
    const ext = dotIndex !== -1 ? fileName.substring(dotIndex + 1).toLowerCase() : '';
    
    if (ext === 'pdf') {
      return (
        <iframe
          src={`${url}#toolbar=0`}
          title="Output PDF Preview"
          className="large-pdf-preview"
        />
      );
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return (
        <img
          src={url}
          alt="Output Image Preview"
          className="large-image-preview"
        />
      );
    } else {
      const fileColor = '#64748b';
      return (
        <div className="large-placeholder-preview">
          <div className="large-file-badge" style={{ backgroundColor: fileColor }}>
            {ext.toUpperCase()}
          </div>
          <p className="large-file-name">{fileName}</p>
          <p className="large-file-meta">
            Preview not supported for this file type.
          </p>
        </div>
      );
    }
  };

  if (showLandingPage) {
    return (
      <div className="landing-page-container">
        {/* Navigation Bar */}
        <nav className="landing-nav">
          <div className="landing-nav-logo-wrapper" onClick={() => setShowLandingPage(true)}>
            <svg className="logo-svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <rect x="3" y="5" width="12" height="14" rx="2" fill="url(#logo-grad)" opacity="0.7" />
              <rect x="9" y="3" width="12" height="14" rx="2" fill="url(#logo-grad)" />
              <path d="M12 7h6M12 11h4M12 13h6" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="logo-text">Omni<span>PDF</span></span>
          </div>

          <ul className="landing-nav-links">
            <li className="landing-nav-text-item">
              <a 
                href="#features" 
                className="landing-nav-link" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' }); 
                }}
              >
                Features
              </a>
            </li>
            <li className="landing-nav-text-item">
              <a 
                href="#how-it-works" 
                className="landing-nav-link" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  document.getElementById('steps-section')?.scrollIntoView({ behavior: 'smooth' }); 
                }}
              >
                How It Works
              </a>
            </li>
            <li className="landing-nav-text-item">
              <a 
                href="#faq" 
                className="landing-nav-link" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' }); 
                }}
              >
                FAQ
              </a>
            </li>
            <li className="landing-nav-text-item">
              <a 
                href="#privacy" 
                className="landing-nav-link" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  setShowPrivacyModal(true); 
                }}
              >
                Privacy Policy
              </a>
            </li>
            <li>
              <a 
                href="https://neo-files-transfer.pages.dev/download/fa1ff58a1e36" 
                className="landing-nav-btn"
              >
                📥 Get Android Client
              </a>
            </li>
            <li>
              <button 
                onClick={() => setShowLandingPage(false)} 
                className="landing-nav-btn primary"
              >
                Open Workspace
              </button>
            </li>
          </ul>
        </nav>

        {/* Hero Section */}
        <main className="landing-hero">
          <div className="landing-tagline animate-fade-in">
            <span className="glow-dot"></span>
            Decentralized & Premium Browser Utility Hub
          </div>
          <h1 className="landing-title animate-fade-in delay-1">
            Modular PDF Sandbox. <span>100% Confidential.</span>
          </h1>
          <p className="landing-subtitle animate-fade-in delay-2">
            Merge, compress, convert, organize, encrypt, and run Gemini AI summarization on your documents locally inside browser memory. Your files never touch a cloud database.
          </p>

          <div className="landing-actions animate-fade-in delay-3">
            <button 
              className="shine-btn shine-btn-primary" 
              onClick={() => setShowLandingPage(false)}
            >
              Launch Web Workspace
            </button>
            <a 
              href="https://neo-files-transfer.pages.dev/download/fa1ff58a1e36" 
              className="shine-btn shine-btn-secondary"
            >
              Download Android APK
            </a>
          </div>

          {/* High-Fidelity Workspace Mockup */}
          <div className="landing-mockup-wrapper animate-fade-in delay-3">
            <div className="landing-mockup-window">
              <div className="mockup-window-header">
                <div className="mockup-window-dots">
                  <span className="mockup-window-dot red"></span>
                  <span className="mockup-window-dot yellow"></span>
                  <span className="mockup-window-dot green"></span>
                </div>
                <div className="mockup-window-address">omnipdf.app/workspace/compress</div>
                <div></div>
              </div>
              <div className="mockup-window-body">
                <div className="mockup-sidebar">
                  <div className="mockup-sidebar-item active">
                    <span className="sidebar-dot green"></span> Compress PDF
                  </div>
                  <div className="mockup-sidebar-item">
                    <span className="sidebar-dot blue"></span> Merge PDF
                  </div>
                  <div className="mockup-sidebar-item">
                    <span className="sidebar-dot blue"></span> Split PDF
                  </div>
                  <div className="mockup-sidebar-item">
                    <span className="sidebar-dot purple"></span> AI Summarizer
                  </div>
                </div>
                <div className="mockup-workspace-main">
                  <div className="mockup-dropzone">
                    <div className="mockup-dropzone-icon">📥</div>
                    <div className="mockup-dropzone-text">annual_financial_statement.pdf</div>
                    <div className="mockup-dropzone-sub">Size: 4.8 MB | Pages: 24 | Type: PDF Document</div>
                    <div className="mockup-progress-bar">
                      <div className="mockup-progress-fill"></div>
                    </div>
                  </div>
                  <div className="mockup-options-card">
                    <div className="mockup-option-row">
                      <span>Compression Level</span>
                      <span className="badge-pill">Medium (Recommended)</span>
                    </div>
                    <div className="mockup-option-row">
                      <span>Output File Size</span>
                      <span className="text-highlight">~1.2 MB (-75%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Dynamic Category Switcher */}
        <section className="landing-directory-section animate-fade-in delay-4">
          <h2 className="landing-section-title">Explore the OmniPDF Suite</h2>
          <p className="landing-section-subtitle">Select any specialized tool to launch directly into the workspace.</p>
          
          <div className="landing-category-tabs">
            {[
              { id: 'all', label: 'All Tools' },
              { id: 'optimize', label: 'Optimize & Convert' },
              { id: 'organize', label: 'Organize & Edit' },
              { id: 'security', label: 'Security & Access' },
              { id: 'ai', label: 'AI Intelligence' },
            ].map(cat => (
              <button
                key={cat.id}
                className={`landing-tab-btn ${landingCategory === cat.id ? 'active' : ''}`}
                onClick={() => setLandingCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="landing-tool-grid">
            {tools.filter(tool => {
              if (landingCategory === 'all') return true;
              if (landingCategory === 'optimize') {
                return ['compress', 'jpg-to-pdf', 'pdf-to-jpg', 'word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf'].includes(tool.id);
              }
              if (landingCategory === 'organize') {
                return ['merge', 'split', 'rotate', 'organize-pdf', 'remove-pages', 'extract-pages', 'crop', 'watermark', 'page-numbers', 'sign'].includes(tool.id);
              }
              if (landingCategory === 'security') {
                return ['protect', 'unlock', 'redact'].includes(tool.id);
              }
              if (landingCategory === 'ai') {
                return ['ocr', 'ai-summarizer'].includes(tool.id);
              }
              return true;
            }).map((tool) => (
              <div 
                key={tool.id} 
                className="landing-tool-card"
                onClick={() => {
                  setSelectedTool(tool);
                  setShowLandingPage(false);
                  setProcessedResult(null);
                }}
              >
                <div 
                  className="landing-tool-icon-wrapper"
                  style={{ backgroundColor: `${tool.iconColor}15`, color: tool.iconColor }}
                >
                  {tool.iconPath}
                </div>
                <h3 className="landing-tool-card-title">{tool.name}</h3>
                <p className="landing-tool-card-desc">{tool.description}</p>
                <div className="landing-tool-card-footer">
                  <span>Launch Tool</span>
                  <span>→</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works Stepper */}
        <section id="steps-section" className="landing-steps-section">
          <h2 className="landing-section-title">Streamlined PDF Workflow</h2>
          <p className="landing-section-subtitle">Optimize, edit, and export files in three effortless steps.</p>
          <div className="landing-steps animate-fade-in">
            <div className="landing-step-card">
              <div className="landing-step-num">1</div>
              <h4 className="landing-step-title">Select Any Tool</h4>
              <p className="landing-step-desc">Pick from our premium sandbox for merging, compressing, organizing, encrypting, or AI summary analysis.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-num">2</div>
              <h4 className="landing-step-title">Local Workspace</h4>
              <p className="landing-step-desc">Upload files into our secure interface. All heavy processing happens quickly and locally in your browser memory.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-num">3</div>
              <h4 className="landing-step-title">Secure Download</h4>
              <p className="landing-step-desc">Download your output instantly. Files are never stored or tracked, keeping your documents 100% confidential.</p>
            </div>
          </div>
        </section>

        {/* Security & Features Spotlight */}
        <section id="features-section" className="landing-features">
          <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3 className="landing-feature-title">Absolute File Privacy</h3>
            <p className="landing-feature-desc">All primary operations run inside your browser cache. Documents never touch cloud databases or remote servers unless explicitly required for AI.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <h3 className="landing-feature-title">High Speed Local Processing</h3>
            <p className="landing-feature-desc">Compress document sizes by up to 90% in seconds without quality compromises, using hardware-accelerated local WebAssembly libraries.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <h3 className="landing-feature-title">Integrated AI Engines</h3>
            <p className="landing-feature-desc">Transcribe pages via OCR or query deep content hierarchies with semantic summaries using your own local Gemini API developer keys.</p>
          </div>
        </section>

        {/* Mobile Promo Card */}
        <section className="landing-mobile-promo">
          <div className="mobile-promo-card">
            <div className="mobile-promo-info">
              <span className="promo-badge">NEW RELEASE</span>
              <h3 className="promo-title">OmniPDF Mobile Client is Here</h3>
              <p className="promo-desc">Take the entire PDF modular workspace with you on your Android device. Offline validations, password check protection, and compression on the go.</p>
              <a 
                href="https://neo-files-transfer.pages.dev/download/fa1ff58a1e36" 
                className="shine-btn shine-btn-primary"
                style={{ alignSelf: 'flex-start', marginTop: '12px' }}
              >
                📥 Download Optimized APK
              </a>
            </div>
            <div className="mobile-promo-mockup">
              <div className="phone-outline">
                <div className="phone-screen">
                  <div className="phone-header">
                    <div className="phone-camera"></div>
                    <div className="phone-battery">100%</div>
                  </div>
                  <div className="phone-app-content">
                    <div className="phone-logo">Omni<span>PDF</span></div>
                    <div className="phone-card-preview">Merge PDF</div>
                    <div className="phone-card-preview">Compress PDF</div>
                    <div className="phone-card-preview">AI Summarizer</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq-section" className="landing-faq-section">
          <h2 className="landing-section-title">Frequently Asked Questions</h2>
          <p className="landing-section-subtitle">Common queries regarding OmniPDF's architecture and security.</p>
          
          <div className="faq-accordion-container">
            {[
              {
                q: "Are my files safe? How are they processed?",
                a: "Absolutely. OmniPDF processes all standard operations (merging, splitting, compressing, watermarking, rotating, etc.) directly inside your browser's local memory. Your files are never uploaded to any remote server, ensuring total confidentiality."
              },
              {
                q: "Do I need to pay or register an account?",
                a: "No. All features of the OmniPDF suite are 100% free, require no registration, signups, or subscription plans, and contain no hidden limits."
              },
              {
                q: "How does the AI Summarizer and OCR work?",
                a: "AI operations securely connect to the Google Gemini API directly from your browser. We require you to supply your own API key which remains locally cached in your browser. No middleman servers track your requests."
              },
              {
                q: "Can I use OmniPDF offline?",
                a: "Yes. Once the website is loaded, all standard processing tools (like merge, split, compress, and rotate) can be used completely offline without an active internet connection."
              }
            ].map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={index} className={`faq-item ${isOpen ? 'open' : ''}`}>
                  <button 
                    className="faq-question-btn"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  >
                    <span>{faq.q}</span>
                    <span className="faq-arrow">{isOpen ? '−' : '+'}</span>
                  </button>
                  <div className="faq-answer">
                    <p>{faq.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="landing-footer">
          <div className="landing-footer-grid">
            <div className="footer-col-brand">
              <span className="logo-text">Omni<span>PDF</span></span>
              <p>The privacy-first PDF utility hub for developers and professionals.</p>
            </div>
            <div className="footer-col-links">
              <h4>Support Contact</h4>
              <p>Email: <a href="mailto:omnipdfadminsupport@gmail.com">omnipdfadminsupport@gmail.com</a></p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} OmniPDF. Engineered for productivity.</p>
          </div>
        </footer>

        {showPrivacyModal && (
          <div className="privacy-modal-overlay" onClick={() => setShowPrivacyModal(false)}>
            <div className="privacy-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="privacy-modal-header">
                <h3>OmniPDF Privacy Policy</h3>
                <button className="close-modal-btn" onClick={() => setShowPrivacyModal(false)}>&times;</button>
              </div>
              <div className="privacy-modal-body">
                <p><strong>Last Updated: June 2026</strong></p>
                <p>At OmniPDF, privacy is our top priority. We believe that your documents should remain entirely yours. Here is how we ensure your data safety:</p>
                
                <h4>1. Direct Browser Processing</h4>
                <p>Tools like PDF Compression, watermarking, and minor rendering are processed directly in your local web browser using webassembly/javascript. Your files never touch a server.</p>
                
                <h4>2. Encrypted Server Pipelines</h4>
                <p>For operations requiring cloud helpers (e.g. OCR and AI summarization), your files are uploaded via highly secure SSL/TLS channels, processed in isolated temporary memory, and instantly deleted from disk upon operation success.</p>
                
                <h4>3. Zero Retention & Tracking</h4>
                <p>We do not store, keep, track, or share your documents under any circumstances. Once you close your browser tab or complete download, the file cache is purged.</p>

                <h4>4. Android App Safety</h4>
                <p>The OmniPDF Android application processes operations locally or via the exact same secure server pipelines without requiring intrusive permissions (like contacts or location details).</p>
              </div>
              <div className="privacy-modal-footer">
                <button className="shine-btn shine-btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }} onClick={() => setShowPrivacyModal(false)}>I Understand</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Navigation Bar */}
      {selectedTool ? (
        <header className="app-header dashboard-header">
          <div className="header-left">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setShowLandingPage(true); setSelectedTool(null); setProcessedResult(null); }} 
              className="logo-link"
            >
              <div className="landing-nav-logo-wrapper">
                <svg className="logo-svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="logo-grad-header" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <rect x="3" y="5" width="12" height="14" rx="2" fill="url(#logo-grad-header)" opacity="0.7" />
                  <rect x="9" y="3" width="12" height="14" rx="2" fill="url(#logo-grad-header)" />
                  <path d="M12 7h6M12 11h4M12 13h6" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="logo-text">Omni<span>PDF</span></span>
              </div>
            </a>
            <span className="header-breadcrumb-separator">/</span>
            <span className="header-active-tool">
              <span className="tool-dot" style={{ backgroundColor: selectedTool.iconColor }}></span>
              {selectedTool.name}
            </span>
          </div>
          
          <div className="header-actions">
            <div className="quick-switch-wrapper">
              <select
                value={selectedTool.id}
                onChange={(e) => {
                  const target = tools.find(t => t.id === e.target.value);
                  if (target) {
                    setSelectedTool(target);
                    setProcessedResult(null);
                  }
                }}
                className="quick-switch-select"
              >
                {tools.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => { setSelectedTool(null); setProcessedResult(null); }} 
              className="header-back-btn"
            >
              📋 Tools Dashboard
            </button>
          </div>
        </header>
      ) : (
        <header className="app-header">
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); setShowLandingPage(true); setSelectedTool(null); setActiveTab('All'); setProcessedResult(null); }} 
          className="logo"
        >
          Omni<span>PDF</span>
        </a>
        <ul className="nav-links">
          <li>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setShowLandingPage(true); setSelectedTool(null); setProcessedResult(null); }} 
              className="nav-link"
            >
              HOME
            </a>
          </li>
          <li>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setSelectedTool(tools.find(t => t.id === 'merge') || null); setProcessedResult(null); }} 
              className="nav-link"
            >
              MERGE PDF
            </a>
          </li>
          <li>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setSelectedTool(tools.find(t => t.id === 'split') || null); setProcessedResult(null); }} 
              className="nav-link"
            >
              SPLIT PDF
            </a>
          </li>
          <li>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setSelectedTool(tools.find(t => t.id === 'compress') || null); setProcessedResult(null); }} 
              className="nav-link"
            >
              COMPRESS PDF
            </a>
          </li>
          
          {/* CONVERT PDF Dropdown */}
          <li 
            className="nav-item-dropdown normal-dropdown-container"
            onMouseEnter={() => setOpenDropdown('convert')}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setSelectedTool(null); setActiveTab('Convert to PDF'); setProcessedResult(null); }} 
              className="nav-link"
            >
              CONVERT PDF <span className={`dropdown-indicator ${openDropdown === 'convert' ? 'open' : ''}`}>▼</span>
            </a>
            
            <div className={`normal-dropdown ${openDropdown === 'convert' ? 'dropdown-open' : ''}`}>
              <div className="normal-dropdown-grid">
                <div className="dropdown-col">
                  <div className="dropdown-col-title">Convert to PDF</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'convert_to').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); closeDropdowns(); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="dropdown-col">
                  <div className="dropdown-col-title">Convert from PDF</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'convert_from').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); closeDropdowns(); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </li>
          
          {/* ALL PDF TOOLS Megamenu */}
          <li 
            className="nav-item-dropdown mega-dropdown-container"
            onMouseEnter={() => setOpenDropdown('alltools')}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setSelectedTool(null); setActiveTab('All'); setProcessedResult(null); }} 
              className="nav-link"
            >
              ALL PDF TOOLS <span className={`dropdown-indicator ${openDropdown === 'alltools' ? 'open' : ''}`}>▼</span>
            </a>
            
            <div className={`mega-dropdown ${openDropdown === 'alltools' ? 'dropdown-open' : ''}`}>
              <div className="mega-dropdown-grid">
                {/* Organize Column */}
                <div className="dropdown-col">
                  <div className="dropdown-col-title">Organize PDF</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'organize').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Optimize Column */}
                <div className="dropdown-col">
                  <div className="dropdown-col-title">Optimize PDF</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'optimize').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Convert To Column */}
                <div className="dropdown-col">
                  <div className="dropdown-col-title">Convert to PDF</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'convert_to').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Convert From Column */}
                <div className="dropdown-col">
                  <div className="dropdown-col-title">Convert from PDF</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'convert_from').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Edit Column */}
                <div className="dropdown-col">
                  <div className="dropdown-col-title">Edit PDF</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'edit').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Security Column */}
                <div className="dropdown-col">
                  <div className="dropdown-col-title">PDF Security</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'security').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Intelligence Column */}
                <div className="dropdown-col">
                  <div className="dropdown-col-title">PDF Intelligence</div>
                  <ul className="dropdown-links-list">
                    {tools.filter(t => t.category === 'intelligence').map(tool => (
                      <li key={tool.id}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setShowLandingPage(false); }}
                          className="dropdown-item-link"
                        >
                          <span className="dropdown-icon" style={{ color: tool.iconColor }}>
                            {tool.iconPath}
                          </span>
                          {tool.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </li>
          
          {/* DOWNLOAD APP Link */}
          <li>
            <a 
              href="https://neo-files-transfer.pages.dev/download/fa1ff58a1e36" 
              className="nav-link android-download-link"
              style={{ color: '#10b981', fontWeight: 'bold' }}
            >
              📥 DOWNLOAD APP
            </a>
          </li>
        </ul>

        {/* Mobile Toggle Button */}
        <button 
          className="mobile-menu-toggle" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Navigation"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </header>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Mobile Menu Drawer */}
      <div className={`mobile-menu-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-title">Menu</span>
          <button className="mobile-menu-close" onClick={() => setIsMobileMenuOpen(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="mobile-drawer-content">
          <ul className="mobile-nav-links">
            <li>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setShowLandingPage(true); setSelectedTool(null); setProcessedResult(null); setIsMobileMenuOpen(false); }} 
                className="mobile-nav-link"
              >
                HOME
              </a>
            </li>
            <li>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setSelectedTool(tools.find(t => t.id === 'merge') || null); setProcessedResult(null); setIsMobileMenuOpen(false); }} 
                className="mobile-nav-link"
              >
                MERGE PDF
              </a>
            </li>
            <li>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setSelectedTool(tools.find(t => t.id === 'split') || null); setProcessedResult(null); setIsMobileMenuOpen(false); }} 
                className="mobile-nav-link"
              >
                SPLIT PDF
              </a>
            </li>
            <li>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setSelectedTool(tools.find(t => t.id === 'compress') || null); setProcessedResult(null); setIsMobileMenuOpen(false); }} 
                className="mobile-nav-link"
              >
                COMPRESS PDF
              </a>
            </li>

            <li className="mobile-nav-divider"></li>
            
            {/* CONVERT PDF SECTION */}
            <li className="mobile-nav-section">
              <div className="mobile-nav-section-title">CONVERT TO PDF</div>
              <ul className="mobile-sublinks">
                {tools.filter(t => t.category === 'convert_to').map(tool => (
                  <li key={tool.id}>
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setIsMobileMenuOpen(false); }}
                      className="mobile-sublink-item"
                    >
                      <span className="mobile-sublink-icon" style={{ color: tool.iconColor }}>{tool.iconPath}</span>
                      {tool.name}
                    </a>
                  </li>
                ))}
              </ul>
            </li>

            <li className="mobile-nav-section">
              <div className="mobile-nav-section-title">CONVERT FROM PDF</div>
              <ul className="mobile-sublinks">
                {tools.filter(t => t.category === 'convert_from').map(tool => (
                  <li key={tool.id}>
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setIsMobileMenuOpen(false); }}
                      className="mobile-sublink-item"
                    >
                      <span className="mobile-sublink-icon" style={{ color: tool.iconColor }}>{tool.iconPath}</span>
                      {tool.name}
                    </a>
                  </li>
                ))}
              </ul>
            </li>

            <li className="mobile-nav-divider"></li>

            {/* ALL OTHER TOOLS */}
            <li className="mobile-nav-section">
              <div className="mobile-nav-section-title">ORGANIZE & EDIT</div>
              <ul className="mobile-sublinks">
                {tools.filter(t => ['organize', 'edit'].includes(t.category) && t.id !== 'merge' && t.id !== 'split').map(tool => (
                  <li key={tool.id}>
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setIsMobileMenuOpen(false); }}
                      className="mobile-sublink-item"
                    >
                      <span className="mobile-sublink-icon" style={{ color: tool.iconColor }}>{tool.iconPath}</span>
                      {tool.name}
                    </a>
                  </li>
                ))}
              </ul>
            </li>

            <li className="mobile-nav-section">
              <div className="mobile-nav-section-title">SECURITY & AI</div>
              <ul className="mobile-sublinks">
                {tools.filter(t => ['security', 'intelligence', 'optimize'].includes(t.category) && t.id !== 'compress').map(tool => (
                  <li key={tool.id}>
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setSelectedTool(tool); setProcessedResult(null); setIsMobileMenuOpen(false); }}
                      className="mobile-sublink-item"
                    >
                      <span className="mobile-sublink-icon" style={{ color: tool.iconColor }}>{tool.iconPath}</span>
                      {tool.name}
                    </a>
                  </li>
                ))}
              </ul>
            </li>

            <li className="mobile-nav-divider"></li>

            <li>
              <a 
                href="https://neo-files-transfer.pages.dev/download/fa1ff58a1e36" 
                className="mobile-nav-link android-download-link"
                style={{ color: '#10b981', fontWeight: 'bold', display: 'inline-block', textAlign: 'center', width: '100%', padding: '12px' }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                📥 DOWNLOAD APP
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Main Container */}
      <main className="app-main">
        {processedResult ? (
          <div className="success-layout-vertical">
            {processedResult.downloadUrl && selectedTool?.id !== 'unlock' && selectedTool?.id !== 'protect' && (
              <div className="big-dynamic-preview-container">
                <div className="big-preview-header">
                  <span className="big-preview-title">
                    🔍 Live Preview: {processedResult.fileNameToDownload || processedResult.fileName}
                  </span>
                  <span className="big-preview-subtitle">
                    Processed Output Document
                  </span>
                </div>
                <div className="big-preview-content">
                  {renderSuccessBigPreview(processedResult.downloadUrl, processedResult.fileNameToDownload || processedResult.fileName)}
                </div>
              </div>
            )}

            <div className="success-container">
            <div className="success-icon-wrapper">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            
            <h2 className="success-title">{processedResult.toolName} Done!</h2>
            <p className="success-subtitle">
              {processedResult.successMessage}
            </p>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
              File Name: <em>{processedResult.fileName}</em>
            </p>

            {processedResult.files && processedResult.files.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                {processedResult.files.length > 1 && (
                  <button
                    onClick={() => {
                      processedResult.files?.forEach((f) => {
                        const link = document.createElement('a');
                        link.href = f.downloadUrl || '#';
                        link.download = f.fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      });
                    }}
                    className="download-btn"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                      marginBottom: '16px'
                    }}
                  >
                    ⚡ Download All Files ({processedResult.files.length})
                  </button>
                )}
                {processedResult.files.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = f.downloadUrl || '#';
                      link.download = f.fileName;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="download-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>📥 Download: {f.fileName}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {processedResult.summary && (
                  <div className="success-summary-container">
                    <h4 className="summary-box-title">AI Summary Results</h4>
                    <div className="summary-box-content">
                      {processedResult.summary.split('\n').map((line, i) => (
                        <p key={i} style={{ margin: '0 0 10px 0', lineHeight: 1.6 }}>{line}</p>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(processedResult.summary || '');
                        showToast('success', 'Copied!', 'Summary copied to clipboard.');
                      }}
                      className="copy-summary-btn"
                    >
                      Copy Summary
                    </button>
                  </div>
                )}

                {processedResult.downloadUrl && (
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = processedResult.downloadUrl || '#';
                      link.download = processedResult.fileNameToDownload || `processed_${processedResult.fileName}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="download-btn"
                  >
                    {processedResult.actionText}
                  </button>
                )}
              </>
            )}

            <div className="success-actions">
              <button 
                onClick={() => setProcessedResult(null)} 
                className="action-btn-secondary"
              >
                Process Another File
              </button>
              <button 
                onClick={() => { setProcessedResult(null); setSelectedTool(null); }} 
                className="action-btn-primary"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
        ) : selectedTool ? (
          <div>
            <button onClick={() => { setSelectedTool(null); setProcessedResult(null); }} className="back-btn">
              &larr; Back to Tools Grid
            </button>
            <FileUploadZone
              toolName={selectedTool.name}
              toolId={selectedTool.id}
              allowMultiple={selectedTool.id !== 'split' && selectedTool.id !== 'organize-pdf'}
              isIntelligence={
                selectedTool.category === 'intelligence' ||
                ['ocr', 'pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel'].includes(selectedTool.id)
              }
              acceptedMimeTypes={
                selectedTool.id === 'jpg-to-pdf' || selectedTool.id === 'scan-to-pdf'
                  ? ['image/jpeg', 'image/jpg', 'image/png']
                  : selectedTool.id === 'word-to-pdf'
                  ? ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                  : selectedTool.id === 'powerpoint-to-pdf'
                  ? ['application/vnd.openxmlformats-officedocument.presentationml.presentation']
                  : selectedTool.id === 'excel-to-pdf'
                  ? ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
                  : selectedTool.id === 'html-to-pdf'
                  ? ['text/html']
                  : ['application/pdf']
              }
              onProcess={handleProcessTool}
            />
          </div>
        ) : (
          <div>
            {/* Hero Banner */}
            <section className="hero-section">
              <h1 className="hero-title">Every tool you need to work with PDFs in one place</h1>
              <p className="hero-subtitle">
                Every tool you need to use PDFs, at your fingertips. All are 100% FREE and easy to use! Merge,
                split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
              </p>
            </section>

            {/* Filter Tabs */}
            <div className="tabs-container">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Grid Area */}
            <div className="tool-grid">
              {filteredTools.length === 0 ? (
                <div className="empty-grid">
                  <p>No tools configured in this category yet. Check back soon!</p>
                </div>
              ) : (
                filteredTools.map((tool) => (
                  <div
                    key={tool.id}
                    onClick={() => setSelectedTool(tool)}
                    className="tool-card"
                  >
                    <div 
                      className="icon-wrapper" 
                      style={{ backgroundColor: `${tool.iconColor}22`, color: tool.iconColor }}
                    >
                      {tool.iconPath}
                    </div>
                    <h3 className="card-title">{tool.name}</h3>
                    <p className="card-desc">{tool.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        &copy; {new Date().getFullYear()} OmniPDF. Decoupled Cloud Architecture Blueprint.
      </footer>

      {/* ─── Toast Notification Container ─── */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}${toast.exiting ? ' toast-exit' : ''}`}
          >
            <div className="toast-icon">{toastIcons[toast.type]}</div>
            <div className="toast-body">
              <div className="toast-title">{toast.title || toastTitles[toast.type]}</div>
              {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
            <button className="toast-close" onClick={() => dismissToast(toast.id)}>✕</button>
            <div className="toast-progress" />
          </div>
        ))}
      </div>
    </div>
  );
}
