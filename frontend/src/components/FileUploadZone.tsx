import React, { useState, useRef, DragEvent, useEffect } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Point the worker at the bundled worker file
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const getFileExtension = (file: File): string => {
  const dotIndex = file.name.lastIndexOf('.');
  return dotIndex !== -1 ? file.name.substring(dotIndex + 1).toLowerCase() : '';
};

const getFileColor = (file: File): string => {
  const ext = getFileExtension(file);
  if (ext === 'pdf') return '#ef4444'; // Red
  if (ext === 'docx' || ext === 'doc') return '#2563eb'; // Blue
  if (ext === 'pptx' || ext === 'ppt') return '#ea580c'; // Orange
  if (ext === 'xlsx' || ext === 'xls') return '#16a34a'; // Green
  if (ext === 'html' || ext === 'htm') return '#ca8a04'; // Yellow
  return '#64748b'; // Slate
};

interface FileUploadZoneProps {
  toolName: string;
  toolId?: string;
  acceptedMimeTypes?: string[];
  allowMultiple?: boolean;
  isIntelligence?: boolean;
  onProcess: (files: File[], options: Record<string, any>) => Promise<void>;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  toolName,
  toolId = '',
  acceptedMimeTypes = ['application/pdf'],
  allowMultiple = false,
  isIntelligence = false,
  onProcess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileRotations, setFileRotations] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);
  const [bigPreviewUrls, setBigPreviewUrls] = useState<Record<string, string>>({});
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileLoadingMessage, setFileLoadingMessage] = useState('');


  // ─── Tool-specific option states ─────────────────────────────────────────
  const [targetSize, setTargetSize] = useState<number>(500);
  const [targetUnit, setTargetUnit] = useState<'KB' | 'MB'>('KB');
  const [compressionPercent, setCompressionPercent] = useState<number>(50);
  const [watermarkText, setWatermarkText] = useState('OmniPDF');
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(40);
  const [opacity, setOpacity] = useState<number>(0.15);
  const [watermarkPosition, setWatermarkPosition] = useState('center');
  const [summaryFormat, setSummaryFormat] = useState<'bullets' | 'paragraph'>('bullets');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  // Split
  const [splitMode, setSplitMode] = useState<'all' | 'half' | 'range'>('all');
  const [pageRanges, setPageRanges] = useState('');
  // Rotate
  const [rotateAngle, setRotateAngle] = useState<string>('90');
  const [rotatePages, setRotatePages] = useState<string>('all');
  // Remove pages
  const [pageNumbers, setPageNumbers] = useState('');
  // Extract pages
  const [extractPageRanges, setExtractPageRanges] = useState('');
  // Organize
  const [pageOrder, setPageOrder] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [organizeMode, setOrganizeMode] = useState<'reverse' | 'normal' | 'custom'>('reverse');
  // Page numbers
  const [pageNumPosition, setPageNumPosition] = useState('bottom-center');
  const [pageNumStart, setPageNumStart] = useState<number>(1);
  const [pageNumPrefix, setPageNumPrefix] = useState('');
  // Protect / Unlock
  const [pdfPassword, setPdfPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Crop
  const [cropLeft, setCropLeft] = useState<number>(10);
  const [cropTop, setCropTop] = useState<number>(10);
  const [cropRight, setCropRight] = useState<number>(10);
  const [cropBottom, setCropBottom] = useState<number>(10);
  // Sign
  const [signatureText, setSignatureText] = useState<string>('Signed by OmniPDF User');
  // Redact
  const [redactTerm, setRedactTerm] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera Scanner states and refs
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode }
      });
      setStream(newStream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error('Failed to start camera:', err);
      setErrorMessage('Could not access the camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const index = files.length + 1;
            const file = new File([blob], `scan_page_${index}.jpg`, { type: 'image/jpeg' });
            setFiles(prev => [...prev, file]);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, isCameraActive]);

  useEffect(() => {
    if (files.length > 0 && toolId === 'compress') {
      const targetBytes = files[0].size * (compressionPercent / 100);
      setTargetSize(parseFloat((targetBytes / 1024).toFixed(1)));
      setTargetUnit('KB');
    }
  }, [files, compressionPercent, toolId]);

  useEffect(() => {
    const detectPages = async () => {
      if (files.length > 0 && files[0].type === 'application/pdf') {
        setIsFileLoading(true);
        setFileLoadingMessage('Reading document structure and counting pages...');
        try {
          const arrayBuffer = await files[0].arrayBuffer();
          const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
          const pdfDoc = await loadingTask.promise;
          setPageCount(pdfDoc.numPages);
        } catch (error) {
          console.error('Error detecting PDF page count:', error);
          setPageCount(null);
        } finally {
          setIsFileLoading(false);
          setFileLoadingMessage('');
        }
      } else {
        setPageCount(null);
      }
    };
    detectPages();
  }, [files]);

  useEffect(() => {
    const newBigUrls = { ...bigPreviewUrls };
    let updated = false;

    for (const file of files) {
      if (!newBigUrls[file.name]) {
        newBigUrls[file.name] = URL.createObjectURL(file);
        updated = true;
      }
    }

    if (updated) {
      setBigPreviewUrls(newBigUrls);
    }
  }, [files]);

  useEffect(() => {
    return () => {
      Object.values(bigPreviewUrls).forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
    };
  }, [bigPreviewUrls]);

  useEffect(() => {
    if (selectedPreviewIndex >= files.length && files.length > 0) {
      setSelectedPreviewIndex(files.length - 1);
    }
  }, [files, selectedPreviewIndex]);

  const renderBigPreview = (file: File) => {
    if (!file) return null;
    const ext = getFileExtension(file);
    const cachedUrl = bigPreviewUrls[file.name];
    if (!cachedUrl) return null;

    if (ext === 'pdf') {
      return (
        <iframe
          src={`${cachedUrl}#toolbar=0`}
          title="PDF Preview"
          className="large-pdf-preview"
        />
      );
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return (
        <img
          src={cachedUrl}
          alt="Image Preview"
          className="large-image-preview"
        />
      );
    } else {
      const fileColor = getFileColor(file);
      return (
        <div className="large-placeholder-preview">
          <div className="large-file-badge" style={{ backgroundColor: fileColor }}>
            {ext.toUpperCase()}
          </div>
          <p className="large-file-name">{file.name}</p>
          <p className="large-file-meta">
            Size: {(file.size / 1024 / 1024).toFixed(2)} MB | Preview not supported for this file type.
          </p>
        </div>
      );
    }
  };

  const rotateFile = (fileName: string) => {
    setFileRotations(prev => {
      const current = prev[fileName] || 0;
      const next = (current + 90) % 360;
      if (toolId === 'rotate') {
        setRotateAngle(String(next));
      }
      return { ...prev, [fileName]: next };
    });
  };

  const moveFile = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= files.length) return;
    const updatedFiles = [...files];
    const temp = updatedFiles[index];
    updatedFiles[index] = updatedFiles[newIndex];
    updatedFiles[newIndex] = temp;
    setFiles(updatedFiles);
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const validateAndAddFiles = async (incoming: File[]) => {
    setIsFileLoading(true);
    setFileLoadingMessage('Importing files into workspace...');
    setErrorMessage(null);

    // Let the UI render the loading spinner first
    await new Promise(resolve => setTimeout(resolve, 80));

    try {
      const valid = incoming.filter(f => {
        // For jpg-to-pdf, accept images too
        if (toolId === 'jpg-to-pdf') {
          return ['image/jpeg', 'image/jpg', 'image/png'].includes(f.type);
        }
        return acceptedMimeTypes.includes(f.type);
      });

      if (valid.length === 0) {
        setErrorMessage(
          toolId === 'jpg-to-pdf'
            ? 'Please upload JPG or PNG image files.'
            : 'Invalid file type. Please upload a valid PDF document.'
        );
        return;
      }

      const maxCombinedLimit = 15 * 1024 * 1024; // 15MB total limit

      if (!allowMultiple) {
        const singleFile = valid[0];
        if (singleFile.size > maxCombinedLimit) {
          setErrorMessage(`"${singleFile.name}" is too large. Maximum allowed size is 15MB.`);
          return;
        }
        setFiles([singleFile]);
        setErrorMessage(null);
      } else {
        const addedFiles: File[] = [];
        const skippedFiles: string[] = [];
        let currentTotalSize = files.reduce((sum, f) => sum + f.size, 0);

        for (const file of valid) {
          if (currentTotalSize + file.size <= maxCombinedLimit) {
            addedFiles.push(file);
            currentTotalSize += file.size;
          } else {
            skippedFiles.push(file.name);
          }
        }

        if (addedFiles.length === 0 && skippedFiles.length > 0) {
          setErrorMessage(`Files could not be added. Adding them would exceed the 15MB combined limit.`);
          return;
        }

        const currentCount = files.length;
        const incomingCount = addedFiles.length;
        const totalCount = currentCount + incomingCount;
        const limit = toolId === 'compress' ? 10 : 100;
        if (totalCount > limit) {
          setErrorMessage(`Maximum upload limit is ${limit} files for this tool.`);
          return;
        }

        setFiles(prev => [...prev, ...addedFiles]);

        if (skippedFiles.length > 0) {
          setErrorMessage(`Some files were skipped to stay within the 15MB combined limit: ${skippedFiles.join(', ')}`);
        } else {
          setErrorMessage(null);
        }
      }
    } finally {
      setIsFileLoading(false);
      setFileLoadingMessage('');
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));
  const clearFiles = () => { setFiles([]); setErrorMessage(null); };

  const handleTriggerProcess = async () => {
    if (files.length === 0) {
      setErrorMessage('Please select at least one file to process.');
      return;
    }

    const isAiRequired = ['ocr', 'ai-summarizer'].includes(toolId);
    if (isAiRequired && !geminiKey.trim()) {
      setErrorMessage('A Google Gemini API key must be provided to use this tool.');
      return;
    }

    // Per-tool validation
    if (toolId === 'redact' && !redactTerm.trim()) {
      setErrorMessage('Please enter a term to redact from the PDF.');
      return;
    }
    if (toolId === 'remove-pages' && !pageNumbers.trim()) {
      setErrorMessage('Please enter page numbers to remove (e.g. "1,3,5").');
      return;
    }
    if (toolId === 'extract-pages' && !extractPageRanges.trim()) {
      setErrorMessage('Please enter page ranges to extract (e.g. "1-3,5").');
      return;
    }
    if (toolId === 'split' && splitMode === 'range' && !pageRanges.trim()) {
      setErrorMessage('Please enter page ranges for split (e.g. "1-3,4-6").');
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setErrorMessage(null);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) { clearInterval(interval); return 85; }
        return prev + 10;
      });
    }, 500);

    try {
      const options: Record<string, any> = {
        // Compress
        targetSize, targetUnit,
        // Watermark
        watermarkText, watermarkFontSize, opacity,
        // AI tools
        summaryFormat, geminiKey,
        // Split
        splitMode, pageRanges,
        // Rotate
        angle: rotateAngle, pages: rotatePages,
        // Remove/Extract
        pageNumbers, extractPageRanges,
        // Organize
        pageOrder: organizeMode === 'custom' ? pageOrder : organizeMode,
        // Page numbers & Watermark positions
        position: toolId === 'page-numbers' ? pageNumPosition : (toolId === 'watermark' ? watermarkPosition : undefined),
        startNumber: String(pageNumStart),
        prefix: pageNumPrefix,
        pgNumFontSize: '10',
        // Protect / Unlock
        password: pdfPassword,
        // Crop
        left: cropLeft, top: cropTop, right: cropRight, bottom: cropBottom,
        // Sign
        signatureText,
        // Redact
        term: redactTerm,
      };

      // For extract-pages, we forward extractPageRanges as pageRanges
      if (toolId === 'extract-pages') {
        options.pageRanges = extractPageRanges;
      }

      await onProcess(files, options);
      setProgress(100);
      setTimeout(() => { setIsProcessing(false); setProgress(0); }, 800);
    } catch (err: any) {
      clearInterval(interval);
      setIsProcessing(false);
      setProgress(0);
      setErrorMessage(err.message || 'Operation failed. Please try again.');
    }
  };

  const inputAccept = toolId === 'jpg-to-pdf'
    ? 'image/jpeg,image/jpg,image/png'
    : acceptedMimeTypes.join(',');

  const supportText = toolId === 'jpg-to-pdf'
    ? 'Supports JPG and PNG images (Max 15MB combined)'
    : 'Supports PDFs (Max 15MB combined)';



  return (
    <div className="omnipdf-upload-container">
      <h2 className="upload-header">{toolName}</h2>

      <input
        ref={fileInputRef}
        type="file"
        multiple={allowMultiple}
        accept={inputAccept}
        onChange={handleFileInput}
        style={{ display: 'none' }}
        id="file-input-element"
      />

      {/* Camera Live Feed */}
      {toolId === 'scan-to-pdf' && isCameraActive && (
        <div className="camera-scanner-container" style={{
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '24px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(10px)',
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#60a5fa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }} />
            Live Document Scanner
          </h3>
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '480px',
            aspectRatio: '4/3',
            background: '#000',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
            border: '2px solid rgba(96, 165, 250, 0.2)',
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
            <button
              type="button"
              onClick={capturePhoto}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.2s',
              }}
              title="Capture Scan Page"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19 10h.01M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggleFacingMode}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '8px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🔄 Flip Camera
            </button>
            <button
              type="button"
              onClick={stopCamera}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Close Scanner
            </button>
          </div>
        </div>
      )}

      {/* File Drop Area */}
      {files.length === 0 && (!isCameraActive || toolId !== 'scan-to-pdf') ? (
        <div
          className="drop-zone"
          style={{
            borderColor: dragActive ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
            background: dragActive ? 'rgba(59, 130, 246, 0.05)' : 'rgba(15, 23, 42, 0.6)',
          }}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="drop-text">
            Drag &amp; drop files here, or <span className="browse-text">browse</span>
          </p>
          <p className="sub-text">{supportText}</p>
          {allowMultiple && <p className="sub-text">You can select multiple files</p>}
          {toolId === 'scan-to-pdf' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsCameraActive(true); }}
              style={{
                marginTop: '16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Scan with Camera
            </button>
          )}
        </div>
      ) : (
        <div className="tool-workspace-layout-vertical">
          {/* Big Preview Box spanning across the top */}
          {files.length > 0 && files[selectedPreviewIndex] && toolId !== 'unlock' && toolId !== 'protect' && (
            <div className="big-dynamic-preview-container">
              <div className="big-preview-header">
                <span className="big-preview-title">
                  🔍 Live Preview: {files[selectedPreviewIndex].name}
                </span>
                <span className="big-preview-subtitle">
                  Click any file below to change preview
                </span>
              </div>
              <div className="big-preview-content">
                {renderBigPreview(files[selectedPreviewIndex])}
              </div>
            </div>
          )}

          <div className="tool-workspace-layout">
            <div className="workspace-main-panel">
              <div className="file-list-header">
                <span>Selected Files ({files.length})</span>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {toolId === 'scan-to-pdf' && (
                    <button
                      type="button"
                      onClick={() => setIsCameraActive(true)}
                      className="add-more-btn"
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      📷 Scan Page
                    </button>
                  )}
                  {allowMultiple && (
                    <button onClick={() => fileInputRef.current?.click()} className="add-more-btn">
                      + Add Files
                    </button>
                  )}
                  <button onClick={clearFiles} className="clear-btn">Clear All</button>
                </div>
              </div>
              <div className="preview-file-list">
                {files.map((file, index) => {
                  const rotation = fileRotations[file.name] || 0;
                  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                  const fileColor = getFileColor(file);
                  const fileExt = getFileExtension(file);
                  const isSelected = selectedPreviewIndex === index;

                  return (
                    <div 
                      key={index} 
                      className={`preview-list-item ${isSelected ? 'selected-list-item' : ''}`}
                      onClick={() => setSelectedPreviewIndex(index)}
                    >
                      <div className="item-index-badge">{index + 1}</div>
                      
                      <div className="item-file-badge" style={{ backgroundColor: fileColor }}>
                        {fileExt.toUpperCase() || 'FILE'}
                      </div>
                      
                      <div className="item-details">
                        <span className="item-name" title={file.name}>{file.name}</span>
                        <span className="item-meta">{sizeMB} MB</span>
                      </div>

                      <div className="item-actions" onClick={(e) => e.stopPropagation()}>
                        <button 
                          type="button" 
                          onClick={() => removeFile(index)} 
                          className="item-action-btn delete-btn"
                          title="Remove File"
                        >
                          ❌ Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>

          <div className="changes-sidebar">
            <div className="changes-sidebar-header">
              <h3 className="changes-sidebar-title">⚙️ Changes Box</h3>
              <div className="changes-summary-details">
                <div className="summary-detail-row">
                  <span>Selected files:</span>
                  <strong>{files.length}</strong>
                </div>
                <div className="summary-detail-row">
                  <span>Total Size:</span>
                  <strong>{(files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB</strong>
                </div>
                {pageCount !== null && (
                  <div className="summary-detail-row">
                    <span>Total Pages:</span>
                    <strong>{pageCount}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="settings-panel">
              <h4 className="settings-title">Options Configurator</h4>

              {/* Gemini API Key for intelligence tools */}
              {isIntelligence && (
                <div className="setting-group">
                  <label className="setting-label">Google Gemini API Key:</label>
                  <input
                    type="password"
                    placeholder="Enter your Gemini API Key..."
                    value={geminiKey}
                    onChange={(e) => { setGeminiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }}
                    className="setting-input"
                    id="gemini-api-key-input"
                  />
                </div>
              )}

              {/* COMPRESS options */}
              {toolId === 'compress' && (
                <div className="setting-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="setting-label">Target Size (Compression Level):</label>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#60a5fa' }}>
                      {compressionPercent}% of original ({((files.reduce((acc, f) => acc + f.size, 0)) * (compressionPercent / 100) / 1024).toFixed(0)} KB total)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={compressionPercent}
                    onChange={(e) => setCompressionPercent(parseInt(e.target.value, 10))}
                    style={{
                      width: '100%',
                      accentColor: '#3b82f6',
                      cursor: 'pointer',
                      marginTop: '8px',
                      height: '6px',
                      borderRadius: '3px',
                      background: '#1e293b',
                      outline: 'none',
                    }}
                    id="compression-slider"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    <span>High Compression (10% size)</span>
                    <span>Medium (50%)</span>
                    <span>Low Compression (90% size)</span>
                  </div>
                </div>
              )}

              {/* WATERMARK options */}
              {toolId === 'watermark' && (
                <>
                  <div className="setting-group">
                    <label className="setting-label">Watermark Text:</label>
                    <input
                      type="text"
                      placeholder="e.g. CONFIDENTIAL"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      className="setting-input"
                      id="watermark-text-input"
                    />
                  </div>
                  <div className="setting-group" style={{ marginTop: '10px' }}>
                    <label className="setting-label">Font Size:</label>
                    <input type="number" min="12" max="80" value={watermarkFontSize} onChange={(e) => setWatermarkFontSize(parseInt(e.target.value, 10) || 40)} className="setting-input" />
                  </div>
                  <div className="setting-group" style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="setting-label" style={{ marginBottom: 0 }}>Opacity:</label>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#3b82f6' }}>{Math.round(opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        accentColor: '#3b82f6',
                        cursor: 'pointer',
                        marginTop: '8px',
                        height: '6px',
                        borderRadius: '3px',
                        background: '#1e293b',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div className="setting-group" style={{ marginTop: '10px' }}>
                    <label className="setting-label">Position Placement:</label>
                    <select value={watermarkPosition} onChange={(e) => setWatermarkPosition(e.target.value)} className="setting-select">
                      <option value="center">Center (rotated 45°)</option>
                      <option value="top-left">Top Left (horizontal)</option>
                      <option value="top-center">Top Center (horizontal)</option>
                      <option value="top-right">Top Right (horizontal)</option>
                      <option value="bottom-left">Bottom Left (horizontal)</option>
                      <option value="bottom-center">Bottom Center (horizontal)</option>
                      <option value="bottom-right">Bottom Right (horizontal)</option>
                    </select>
                  </div>
                </>
              )}

              {/* SPLIT options */}
              {toolId === 'split' && (
                <>
                  <div className="setting-group">
                    <label className="setting-label">Split Mode:</label>
                    <select value={splitMode} onChange={(e) => setSplitMode(e.target.value as any)} className="setting-select">
                      <option value="all">Every Page (one PDF per page)</option>
                      <option value="half">Split in Half (2 parts)</option>
                      <option value="range">Custom Page Ranges</option>
                    </select>
                  </div>
                  {splitMode === 'range' && (
                    <div className="setting-group" style={{ marginTop: '10px' }}>
                      <label className="setting-label">Page Ranges (e.g. "1-3,4-6,7"):</label>
                      <input type="text" placeholder="1-3,4-6,7" value={pageRanges} onChange={(e) => setPageRanges(e.target.value)} className="setting-input" />
                    </div>
                  )}
                </>
              )}

              {/* ROTATE options */}
              {toolId === 'rotate' && (
                <div className="setting-row">
                  <div className="setting-col">
                    <label className="setting-label">Rotation Angle:</label>
                    <select value={rotateAngle} onChange={(e) => setRotateAngle(e.target.value)} className="setting-select">
                      <option value="90">90° Clockwise</option>
                      <option value="180">180° (Upside Down)</option>
                      <option value="270">270° (Counter-Clockwise)</option>
                    </select>
                  </div>
                  <div className="setting-col">
                    <label className="setting-label">Pages:</label>
                    <input type="text" placeholder="all  OR  1,3,5" value={rotatePages} onChange={(e) => setRotatePages(e.target.value)} className="setting-input" />
                    <small className="setting-hint">Use "all" or comma-separated page numbers</small>
                  </div>
                </div>
              )}

              {/* REMOVE PAGES options */}
              {toolId === 'remove-pages' && (
                <div className="setting-group">
                  <label className="setting-label">Pages to Remove (e.g. "1,3,5"):</label>
                  <input type="text" placeholder="1,3,5" value={pageNumbers} onChange={(e) => setPageNumbers(e.target.value)} className="setting-input" />
                  <small className="setting-hint">Comma-separated 1-indexed page numbers</small>
                </div>
              )}

              {/* EXTRACT PAGES options */}
              {toolId === 'extract-pages' && (
                <div className="setting-group">
                  <label className="setting-label">Pages to Extract (e.g. "1-3,5,7-9"):</label>
                  <input type="text" placeholder="1-3,5,7-9" value={extractPageRanges} onChange={(e) => setExtractPageRanges(e.target.value)} className="setting-input" />
                  <small className="setting-hint">Use ranges (1-3) or individual pages (5), comma-separated</small>
                </div>
              )}

              {/* ORGANIZE PDF options */}
              {toolId === 'organize-pdf' && (
                <>
                  <div className="setting-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="setting-label">Page Order Mode:</label>
                      {pageCount !== null && (
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#60a5fa' }}>
                          Detected {pageCount} pages
                        </span>
                      )}
                    </div>
                    <select
                      value={organizeMode}
                      onChange={(e) => setOrganizeMode(e.target.value as any)}
                      className="setting-select"
                    >
                      <option value="reverse">
                        {pageCount !== null ? `Down to Up (${pageCount} to 1)` : 'Down to Up (Reverse Pages)'}
                      </option>
                      <option value="normal">
                        {pageCount !== null ? `Up to Down (1 to ${pageCount})` : 'Up to Down (Keep Original Order)'}
                      </option>
                      <option value="custom">Custom Page Order</option>
                    </select>
                  </div>
                  {organizeMode === 'custom' && (
                    <div className="setting-group" style={{ marginTop: '10px' }}>
                      <label className="setting-label">
                        New Page Order (e.g. "3,1,2" for {pageCount || 3}-page PDF):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 3,1,2"
                        value={pageOrder}
                        onChange={(e) => setPageOrder(e.target.value)}
                        className="setting-input"
                      />
                      <small className="setting-hint">
                        Comma-separated 1-indexed page numbers in desired order.
                      </small>
                    </div>
                  )}
                </>
              )}

              {/* PAGE NUMBERS options */}
              {toolId === 'page-numbers' && (
                <>
                  <div className="setting-row">
                    <div className="setting-col" style={{ flex: 2 }}>
                      <label className="setting-label">Position:</label>
                      <select value={pageNumPosition} onChange={(e) => setPageNumPosition(e.target.value)} className="setting-select">
                        <option value="bottom-center">Bottom Center</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="top-center">Top Center</option>
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                      </select>
                    </div>
                    <div className="setting-col">
                      <label className="setting-label">Start Number:</label>
                      <input type="number" min="0" value={pageNumStart} onChange={(e) => setPageNumStart(parseInt(e.target.value, 10) || 1)} className="setting-input" />
                    </div>
                  </div>
                  <div className="setting-group" style={{ marginTop: '10px' }}>
                    <label className="setting-label">Prefix (optional, e.g. "Page "):</label>
                    <input type="text" placeholder="Page " value={pageNumPrefix} onChange={(e) => setPageNumPrefix(e.target.value)} className="setting-input" />
                  </div>
                </>
              )}

              {/* PROTECT options */}
              {toolId === 'protect' && (
                <div className="setting-group">
                  <label className="setting-label">Password to Encrypt PDF:</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter encryption password..."
                      value={pdfPassword}
                      onChange={(e) => setPdfPassword(e.target.value)}
                      className="setting-input"
                      id="protect-password-input"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0
                      }}
                      title={showPassword ? "Hide Password" : "Show Password"}
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <small className="setting-hint">⚠️ Note: Make sure to remember this password; it will be required to open the PDF. Uses strong AES-256 encryption.</small>
                </div>
              )}

              {/* UNLOCK options */}
              {toolId === 'unlock' && (
                <div className="setting-group">
                  <label className="setting-label">PDF Password to Unlock:</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password to unlock PDF..."
                      value={pdfPassword}
                      onChange={(e) => setPdfPassword(e.target.value)}
                      className="setting-input"
                      id="unlock-password-input"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0
                      }}
                      title={showPassword ? "Hide Password" : "Show Password"}
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <small className="setting-hint">⚠️ Note: Enter the password that was used to protect this PDF document.</small>
                </div>
              )}

              {/* AI Summarizer format */}
              {toolId === 'ai-summarizer' && (
                <div className="setting-group">
                  <label className="setting-label">Summary Format:</label>
                  <select value={summaryFormat} onChange={(e) => setSummaryFormat(e.target.value as any)} className="setting-select" id="summary-format-select">
                    <option value="bullets">Key Bullet Points</option>
                    <option value="paragraph">Fluid Narrative Summary</option>
                  </select>
                </div>
              )}



              {/* CROP options */}
              {toolId === 'crop' && (
                <div className="setting-group">
                  <label className="setting-label">Crop Margins (percentage):</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Left (%)</label>
                      <input type="number" min="0" max="49" value={cropLeft} onChange={(e) => setCropLeft(parseInt(e.target.value, 10) || 0)} className="setting-input" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Top (%)</label>
                      <input type="number" min="0" max="49" value={cropTop} onChange={(e) => setCropTop(parseInt(e.target.value, 10) || 0)} className="setting-input" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Right (%)</label>
                      <input type="number" min="0" max="49" value={cropRight} onChange={(e) => setCropRight(parseInt(e.target.value, 10) || 0)} className="setting-input" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Bottom (%)</label>
                      <input type="number" min="0" max="49" value={cropBottom} onChange={(e) => setCropBottom(parseInt(e.target.value, 10) || 0)} className="setting-input" />
                    </div>
                  </div>
                </div>
              )}


              {/* SIGN options */}
              {toolId === 'sign' && (
                <div className="setting-group">
                  <label className="setting-label">Signature Text (Typed Name):</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    className="setting-input"
                    id="signature-text-input"
                  />
                </div>
              )}

              {/* REDACT options */}
              {toolId === 'redact' && (
                <div className="setting-group">
                  <label className="setting-label">Term to Redact (blackout):</label>
                  <input
                    type="text"
                    placeholder="e.g. Email, SSN, confidential info..."
                    value={redactTerm}
                    onChange={(e) => setRedactTerm(e.target.value)}
                    className="setting-input"
                    id="redact-term-input"
                  />
                </div>
              )}

              {/* No-op message for tools with no options */}
              {!isIntelligence &&
                !['compress', 'watermark', 'split', 'rotate', 'remove-pages', 'extract-pages',
                  'organize-pdf', 'page-numbers', 'protect', 'unlock', 'ai-summarizer',
                  'crop', 'sign', 'redact'].includes(toolId) && (
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0' }}>No additional options required for this tool.</p>
              )}
            </div>

            {/* Process Button */}
            {!isProcessing && (
              <button onClick={handleTriggerProcess} className="process-btn" id="process-btn">
                ⚡ Process &amp; Download
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {errorMessage && (
        <div className="error-container">
          <span className="error-text">⚠️ {errorMessage}</span>
        </div>
      )}

      {/* ─── Premium Glassmorphic Loading Overlays ─── */}
      {isProcessing && (
        <div className="web-loading-overlay">
          <div className="web-loading-card">
            <div className="web-loading-spinner-wrapper">
              <div className="web-loading-spinner-outer" />
              <div className="web-loading-spinner-inner" />
              <div className="web-loading-spinner-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            </div>
            <h3 className="web-loading-title">Processing {toolName}</h3>
            <p className="web-loading-subtitle">
              {progress < 30 
                ? 'Uploading files securely...' 
                : progress < 70 
                ? 'Performing PDF operations...' 
                : 'Packaging results for download...'}
            </p>
            <div className="web-loading-progress-container">
              <div className="web-loading-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="web-loading-progress-text">{progress}%</div>
          </div>
        </div>
      )}

      {isFileLoading && (
        <div className="web-loading-overlay">
          <div className="web-loading-card" style={{ maxWidth: '380px', padding: '30px 24px' }}>
            <div className="web-loading-spinner-wrapper" style={{ width: '80px', height: '80px', marginBottom: '20px' }}>
              <div className="web-loading-spinner-outer" style={{ borderWidth: '3px' }} />
              <div className="web-loading-spinner-inner" style={{ borderWidth: '2px' }} />
              <div className="web-loading-spinner-icon" style={{ fontSize: '22px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
            </div>
            <h3 className="web-loading-title" style={{ fontSize: '18px' }}>Preparing Files</h3>
            <p className="web-loading-subtitle" style={{ fontSize: '13px', marginBottom: '0', color: '#94a3b8' }}>
              {fileLoadingMessage || 'Reading file metadata...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
