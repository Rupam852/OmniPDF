import React, { useState, useRef, DragEvent, useEffect } from 'react';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Tool-specific option states ─────────────────────────────────────────
  const [targetSize, setTargetSize] = useState<number>(500);
  const [targetUnit, setTargetUnit] = useState<'KB' | 'MB'>('KB');
  const [compressionPercent, setCompressionPercent] = useState<number>(50);
  const [watermarkText, setWatermarkText] = useState('OmniPDF');
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(40);
  const [opacity, setOpacity] = useState<number>(0.15);
  const [summaryFormat, setSummaryFormat] = useState<'bullets' | 'paragraph'>('bullets');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
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
  // Page numbers
  const [pageNumPosition, setPageNumPosition] = useState('bottom-center');
  const [pageNumStart, setPageNumStart] = useState<number>(1);
  const [pageNumPrefix, setPageNumPrefix] = useState('');
  // Protect / Unlock
  const [pdfPassword, setPdfPassword] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (files.length > 0 && toolId === 'compress') {
      const targetBytes = files[0].size * (compressionPercent / 100);
      setTargetSize(parseFloat((targetBytes / 1024).toFixed(1)));
      setTargetUnit('KB');
    }
  }, [files, compressionPercent, toolId]);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const validateAndAddFiles = (incoming: File[]) => {
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

    const maxLimit = 10 * 1024 * 1024;
    const tooLarge = valid.find(f => f.size > maxLimit);
    if (tooLarge) {
      setErrorMessage(`"${tooLarge.name}" is too large. Maximum allowed size is 10MB.`);
      return;
    }

    if (!allowMultiple) {
      setFiles([valid[0]]);
    } else {
      setFiles(prev => [...prev, ...valid]);
    }
    setErrorMessage(null);
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

    if (isIntelligence && !geminiKey.trim()) {
      setErrorMessage('A Google Gemini API key must be provided to use this tool.');
      return;
    }

    // Per-tool validation
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
        summaryFormat, geminiKey, targetLanguage,
        // Split
        splitMode, pageRanges,
        // Rotate
        angle: rotateAngle, pages: rotatePages,
        // Remove/Extract
        pageNumbers, extractPageRanges,
        // Organize
        pageOrder,
        // Page numbers
        position: pageNumPosition, startNumber: String(pageNumStart), prefix: pageNumPrefix,
        pgNumFontSize: '10',
        // Protect / Unlock
        password: pdfPassword,
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
    ? 'Supports JPG and PNG images up to 10MB each'
    : 'Supports PDFs up to 10MB';

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

      {/* File Drop Area */}
      {files.length === 0 ? (
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
        </div>
      ) : (
        <div className="file-list-container">
          <div className="file-list-header">
            <span>Selected Files ({files.length})</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              {allowMultiple && (
                <button onClick={() => fileInputRef.current?.click()} className="add-more-btn">
                  + Add Files
                </button>
              )}
              <button onClick={clearFiles} className="clear-btn">Clear All</button>
            </div>
          </div>

          <div className="file-grid">
            {files.map((file, index) => (
              <div key={index} className="file-card">
                <div className="file-info">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ marginRight: '8px', flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="file-name" title={file.name}>
                    {file.name.length > 24 ? `${file.name.slice(0, 14)}...${file.name.slice(-8)}` : file.name}
                  </span>
                </div>
                <div className="file-actions">
                  <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button onClick={() => removeFile(index)} className="remove-btn">&times;</button>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Options Panel ──────────────────────────────────────── */}
          <div className="settings-panel">
            <h4 className="settings-title">⚙️ Options Configurator</h4>

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
                    {compressionPercent}% of original ({((files[0]?.size || 0) * (compressionPercent / 100) / 1024).toFixed(0)} KB)
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
                <div className="setting-row" style={{ marginTop: '10px' }}>
                  <div className="setting-col">
                    <label className="setting-label">Font Size:</label>
                    <input type="number" min="12" max="80" value={watermarkFontSize} onChange={(e) => setWatermarkFontSize(parseInt(e.target.value, 10) || 40)} className="setting-input" />
                  </div>
                  <div className="setting-col">
                    <label className="setting-label">Opacity (0.05–1):</label>
                    <input type="number" min="0.05" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="setting-input" />
                  </div>
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
              <div className="setting-group">
                <label className="setting-label">New Page Order (e.g. "3,1,2" for 3-page PDF):</label>
                <input type="text" placeholder="Leave empty to reverse pages" value={pageOrder} onChange={(e) => setPageOrder(e.target.value)} className="setting-input" />
                <small className="setting-hint">Comma-separated 1-indexed page numbers in desired order. Empty = reverse all.</small>
              </div>
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
                <input
                  type="password"
                  placeholder="Enter encryption password..."
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  className="setting-input"
                  id="protect-password-input"
                />
                <small className="setting-hint">⚠️ Note: Make sure to remember this password; it will be required to open the PDF. Uses strong AES-256 encryption.</small>
              </div>
            )}

            {/* UNLOCK options */}
            {toolId === 'unlock' && (
              <div className="setting-group">
                <label className="setting-label">PDF Password to Unlock:</label>
                <input
                  type="password"
                  placeholder="Enter password to unlock PDF..."
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  className="setting-input"
                  id="unlock-password-input"
                />
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

            {/* Translate language */}
            {toolId === 'translate' && (
              <div className="setting-group">
                <label className="setting-label">Target Language:</label>
                <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="setting-select" id="target-language-select">
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Gujarati">Gujarati</option>
                  <option value="Urdu">Urdu</option>
                  <option value="Kannada">Kannada</option>
                  <option value="Odia">Odia</option>
                  <option value="Malayalam">Malayalam</option>
                  <option value="Punjabi">Punjabi</option>
                  <option value="Assamese">Assamese</option>
                  <option value="Chinese (Simplified)">Chinese (Simplified)</option>
                  <option value="Chinese (Traditional)">Chinese (Traditional)</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Korean">Korean</option>
                  <option value="Russian">Russian</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Italian">Italian</option>
                  <option value="Turkish">Turkish</option>
                  <option value="Vietnamese">Vietnamese</option>
                  <option value="Dutch">Dutch</option>
                  <option value="Indonesian">Indonesian</option>
                  <option value="Polish">Polish</option>
                </select>
              </div>
            )}

            {/* No-op message for tools with no options */}
            {!isIntelligence &&
              !['compress', 'watermark', 'split', 'rotate', 'remove-pages', 'extract-pages',
                'organize-pdf', 'page-numbers', 'protect', 'unlock', 'ai-summarizer', 'translate'].includes(toolId) && (
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0' }}>No additional options required for this tool.</p>
            )}
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-text">Processing... {progress}%</div>
            </div>
          )}

          {/* Process Button */}
          {!isProcessing && (
            <button onClick={handleTriggerProcess} className="process-btn" id="process-btn">
              ⚡ Process &amp; Download
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="error-container">
          <span className="error-text">⚠️ {errorMessage}</span>
        </div>
      )}
    </div>
  );
};
