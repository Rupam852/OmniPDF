import { useState, useEffect } from 'react';
import { FileUploadZone } from './components/FileUploadZone';
import { OmniPdfApi } from './services/api';
import { auth, googleProvider } from './services/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'organize' | 'optimize' | 'convert_to' | 'convert_from' | 'edit' | 'security' | 'intelligence' | 'workflow';
  iconColor: string;
  iconPath: JSX.Element;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  
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

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setIsAuthModalOpen(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check credentials.');
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Google Sign-in failed.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setSelectedTool(null);
      setProcessedResult(null);
    } catch (err: any) {
      console.error('Sign out failed:', err);
    }
  };

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
      description: 'Easily convert scanned PDF into searchable and selectable documents.',
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
      id: 'edit-pdf',
      name: 'Edit PDF',
      description: 'Add text, images, shapes or freehand annotations to a PDF document.',
      category: 'edit',
      iconColor: '#a855f7',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
    },
    {
      id: 'translate',
      name: 'Translate PDF',
      description: 'Easily translate PDF files powered by AI while preserving layout structures.',
      category: 'intelligence',
      iconColor: '#6366f1',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    }
  ];

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

    try {
      const token = user ? await user.getIdToken() : undefined;
      console.log(`Processing tool ${selectedTool.id} for user ${user?.uid || 'guest'}`);

      // Helper function to convert base64 to Blob URL
      const base64ToBlobUrl = (base64: string, mimeType = 'application/pdf'): string => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        return URL.createObjectURL(blob);
      };

      if (selectedTool.id === 'merge') {
        const result = await OmniPdfApi.mergePdfs(token || '', files);
        if (result.fileData) {
          const url = base64ToBlobUrl(result.fileData);
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files.map(f => f.name).join(', '),
            downloadUrl: url,
            successMessage: "Your PDF files have been merged successfully!",
            actionText: "Download Merged PDF",
            fileNameToDownload: result.fileName || `merged_${Date.now()}.pdf`,
          });
        }
      } else if (selectedTool.id === 'ai-summarizer') {
        const result = await OmniPdfApi.summarizePdf(token || '', files[0], options.geminiKey);
        const url = result.fileData ? base64ToBlobUrl(result.fileData) : undefined;
        setProcessedResult({
          toolName: selectedTool.name,
          fileName: files[0].name,
          summary: result.summary,
          downloadUrl: url,
          fileNameToDownload: result.fileName || `summary_${files[0].name}.pdf`,
          successMessage: "Your PDF document has been summarized successfully using Gemini AI!",
          actionText: "Download Summary PDF",
        });
      } else if (selectedTool.id === 'translate') {
        const result = await OmniPdfApi.translatePdf(token || '', files[0], options.targetLanguage || 'Spanish', options.geminiKey);
        if (result.fileData) {
          const url = base64ToBlobUrl(result.fileData);
          const dotIndex = files[0].name.lastIndexOf('.');
          const baseName = dotIndex !== -1 ? files[0].name.substring(0, dotIndex) : files[0].name;
          const ext = dotIndex !== -1 ? files[0].name.substring(dotIndex) : '.pdf';
          const downloadName = `translated_${options.targetLanguage || 'Spanish'}_${baseName}${ext}`;

          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: url,
            successMessage: `Your PDF document has been successfully translated to ${options.targetLanguage || 'Spanish'}!`,
            actionText: `Download Translated PDF`,
            fileNameToDownload: downloadName,
          });
        }
      } else if (selectedTool.id === 'split') {
        const result = await OmniPdfApi.runPdfTool('split', token || '', files[0]);
        if (result.files) {
          const processedFiles = result.files.map(f => ({
            fileName: f.fileName,
            downloadUrl: base64ToBlobUrl(f.fileData)
          }));
          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            files: processedFiles,
            successMessage: "Your PDF file has been split successfully!",
            actionText: "Download Split PDFs",
          });
        }
      } else {
        // Other tools: compress, protect, rotate, watermark
        const endpointMap: Record<string, string> = {
          'compress': 'compress',
          'protect': 'protect',
          'rotate': 'rotate',
          'watermark': 'watermark',
        };

        const endpoint = endpointMap[selectedTool.id] || selectedTool.id;
        
        let toolOptions: Record<string, any> = {};
        if (selectedTool.id === 'protect') {
          toolOptions.password = options.password || 'OmniPdfSecure';
        } else if (selectedTool.id === 'watermark') {
          toolOptions.watermarkText = options.watermarkText || 'OmniPDF AI';
        } else if (selectedTool.id === 'compress') {
          toolOptions.targetSize = options.targetSize || 500;
          toolOptions.targetUnit = options.targetUnit || 'KB';
        }

        const result = await OmniPdfApi.runPdfTool(endpoint, token || '', files[0], toolOptions);
        
        if (result.fileData) {
          const url = base64ToBlobUrl(result.fileData);
          
          let actionText = 'Download Processed PDF';
          let successMessage = result.message || `Your PDF has been processed using ${selectedTool.name}!`;
          let suffix = '_processed';

          if (selectedTool.id === 'compress') {
            actionText = 'Download Compressed PDF';
            suffix = '_compressed';
          } else if (selectedTool.id === 'protect') {
            successMessage = 'Your PDF has been protected with password encryption!';
            actionText = 'Download Protected PDF';
            suffix = '_protected';
          } else if (selectedTool.id === 'rotate') {
            successMessage = 'Your PDF pages have been rotated successfully!';
            actionText = 'Download Rotated PDF';
            suffix = '_rotated';
          } else if (selectedTool.id === 'watermark') {
            successMessage = 'Watermark has been stamped onto your PDF successfully!';
            actionText = 'Download Watermarked PDF';
            suffix = '_watermarked';
          }

          const dotIndex = files[0].name.lastIndexOf('.');
          const baseName = dotIndex !== -1 ? files[0].name.substring(0, dotIndex) : files[0].name;
          const ext = dotIndex !== -1 ? files[0].name.substring(dotIndex) : '.pdf';
          const downloadName = `${baseName}${suffix}${ext}`;

          setProcessedResult({
            toolName: selectedTool.name,
            fileName: files[0].name,
            downloadUrl: url,
            successMessage,
            actionText,
            fileNameToDownload: downloadName,
          });
        }
      }
    } catch (err: any) {
      alert(`Operation failed: ${err.message || err}`);
      throw err;
    }
  };

  return (
    <div style={appStyles.appWrapper}>
      {/* Navigation Bar */}
      <header className="app-header">
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); setSelectedTool(null); setActiveTab('All'); setProcessedResult(null); }} 
          className="logo"
        >
          Omni<span>PDF</span> AI
        </a>
        <ul className="nav-links">
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
          <li>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setSelectedTool(null); setActiveTab('Convert PDF'); setProcessedResult(null); }} 
              className="nav-link"
            >
              CONVERT PDF
            </a>
          </li>
          <li>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setSelectedTool(null); setActiveTab('All'); setProcessedResult(null); }} 
              className="nav-link"
            >
              ALL PDF TOOLS
            </a>
          </li>
        </ul>
      </header>

      {/* Main Container */}
      <main style={appStyles.main}>
        {processedResult ? (
          <div style={appStyles.successContainer}>
            <div style={appStyles.successIconWrapper}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            
            <h2 style={appStyles.successTitle}>{processedResult.toolName} Done!</h2>
            <p style={appStyles.successSubtitle}>
              {processedResult.successMessage}
            </p>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
              File Name: <em>{processedResult.fileName}</em>
            </p>

            {processedResult.files && processedResult.files.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
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
                    style={appStyles.downloadBtn}
                  >
                    Download Part {i + 1}: {f.fileName}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {processedResult.summary && (
                  <div style={appStyles.successSummaryContainer}>
                    <h4 style={appStyles.summaryBoxTitle}>AI Summary Results</h4>
                    <div style={appStyles.summaryBoxContent}>
                      {processedResult.summary.split('\n').map((line, i) => (
                        <p key={i} style={{ margin: '0 0 10px 0', lineHeight: 1.6 }}>{line}</p>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(processedResult.summary || '');
                        alert('Summary copied to clipboard!');
                      }}
                      style={appStyles.copySummaryBtn}
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
                    style={appStyles.downloadBtn}
                  >
                    {processedResult.actionText}
                  </button>
                )}
              </>
            )}

            <div style={appStyles.successActions}>
              <button 
                onClick={() => setProcessedResult(null)} 
                style={appStyles.actionBtnSecondary}
              >
                Process Another File
              </button>
              <button 
                onClick={() => { setProcessedResult(null); setSelectedTool(null); }} 
                style={appStyles.actionBtnPrimary}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        ) : selectedTool ? (
          <div>
            <button onClick={() => { setSelectedTool(null); setProcessedResult(null); }} style={appStyles.backBtn}>
              &larr; Back to Tools Grid
            </button>
            <FileUploadZone
              toolName={selectedTool.name}
              allowMultiple={selectedTool.id === 'merge'}
              isIntelligence={selectedTool.category === 'intelligence'}
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
            <div style={appStyles.tabsContainer}>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    ...appStyles.tabBtn,
                    backgroundColor: activeTab === tab ? '#1e293b' : 'transparent',
                    borderColor: activeTab === tab ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                    color: activeTab === tab ? '#60a5fa' : '#94a3b8',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Grid Area */}
            <div style={appStyles.grid}>
              {filteredTools.length === 0 ? (
                <div style={appStyles.emptyGrid}>
                  <p>No tools configured in this category yet. Check back soon!</p>
                </div>
              ) : (
                filteredTools.map((tool) => (
                  <div
                    key={tool.id}
                    onClick={() => setSelectedTool(tool)}
                    style={appStyles.card}
                    className="tool-card"
                  >
                    <div style={{ ...appStyles.iconWrapper, backgroundColor: `${tool.iconColor}22`, color: tool.iconColor }}>
                      {tool.iconPath}
                    </div>
                    <h3 style={appStyles.cardTitle}>{tool.name}</h3>
                    <p style={appStyles.cardDesc}>{tool.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={appStyles.footer}>
        &copy; {new Date().getFullYear()} OmniPDF AI. Decoupled Cloud Architecture Blueprint.
      </footer>
    </div>
  );
}

const appStyles: Record<string, React.CSSProperties> = {
  appWrapper: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#030712',
  },
  authButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userEmail: {
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: 500,
  },
  loginBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
  },
  main: {
    flex: 1,
    padding: '20px 40px 60px 40px',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  tabsContainer: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '10px',
    margin: '30px 0',
  },
  tabBtn: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '24px',
    marginTop: '20px',
  },
  emptyGrid: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '40px',
    color: '#64748b',
    border: '1px dashed rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
  },
  card: {
    backgroundColor: '#0b1329',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
  },
  iconWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 700,
    marginBottom: '10px',
    color: '#f8fafc',
  },
  cardDesc: {
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: '1.5',
  },
  footer: {
    textAlign: 'center',
    padding: '24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    fontSize: '12px',
    color: '#64748b',
  },
  successContainer: {
    maxWidth: '600px',
    margin: '40px auto',
    padding: '40px 30px',
    backgroundColor: '#0b1329',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    textAlign: 'center',
    color: '#f8fafc',
    fontFamily: '"Outfit", "Inter", sans-serif',
  },
  successIconWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  successTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#22c55e',
    marginBottom: '12px',
  },
  successSubtitle: {
    fontSize: '16px',
    color: '#e2e8f0',
    marginBottom: '10px',
    lineHeight: 1.6,
    fontWeight: '500',
  },
  downloadBtn: {
    display: 'inline-block',
    padding: '14px 28px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    marginBottom: '30px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.4)',
  },
  successSummaryContainer: {
    textAlign: 'left',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '30px',
  },
  summaryBoxTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#60a5fa',
    margin: '0 0 16px 0',
  },
  summaryBoxContent: {
    maxHeight: '300px',
    overflowY: 'auto',
    color: '#cbd5e1',
    fontSize: '14px',
    paddingRight: '8px',
    marginBottom: '16px',
  },
  copySummaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#1e293b',
    color: '#3b82f6',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  successActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '24px',
  },
  actionBtnPrimary: {
    padding: '10px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: '#94a3b8',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actionBtnSecondary: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#3b82f6',
    border: '1px solid #3b82f6',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};
