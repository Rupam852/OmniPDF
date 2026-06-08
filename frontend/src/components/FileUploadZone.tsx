import React, { useState, useRef, DragEvent } from 'react';

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
  // Protect
  const [protectPassword, setProtectPassword] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // Protect
        password: protectPassword,
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
    <div className="omnipdf-upload-container" style={styles.container}>
      <h2 style={styles.header}>{toolName}</h2>

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
          style={{
            ...styles.dropZone,
            borderColor: dragActive ? '#3b82f6' : '#1e293b',
            background: dragActive ? 'rgba(59, 130, 246, 0.05)' : 'rgba(15, 23, 42, 0.6)',
          }}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={styles.uploadIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p style={styles.dropText}>
            Drag &amp; drop files here, or <span style={styles.browseText}>browse</span>
          </p>
          <p style={styles.subText}>{supportText}</p>
          {allowMultiple && <p style={styles.subText}>You can select multiple files</p>}
        </div>
      ) : (
        <div style={styles.fileListContainer}>
          <div style={styles.fileListHeader}>
            <span>Selected Files ({files.length})</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              {allowMultiple && (
                <button onClick={() => fileInputRef.current?.click()} style={styles.addMoreBtn}>
                  + Add Files
                </button>
              )}
              <button onClick={clearFiles} style={styles.clearBtn}>Clear All</button>
            </div>
          </div>

          <div style={styles.fileGrid}>
            {files.map((file, index) => (
              <div key={index} style={styles.fileCard}>
                <div style={styles.fileInfo}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ marginRight: '8px', flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={styles.fileName} title={file.name}>
                    {file.name.length > 24 ? `${file.name.slice(0, 14)}...${file.name.slice(-8)}` : file.name}
                  </span>
                </div>
                <div style={styles.fileActions}>
                  <span style={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button onClick={() => removeFile(index)} style={styles.removeBtn}>&times;</button>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Options Panel ──────────────────────────────────────── */}
          <div style={styles.settingsPanel}>
            <h4 style={styles.settingsTitle}>⚙️ Options Configurator</h4>

            {/* Gemini API Key for intelligence tools */}
            {isIntelligence && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>Google Gemini API Key:</label>
                <input
                  type="password"
                  placeholder="Enter your Gemini API Key..."
                  value={geminiKey}
                  onChange={(e) => { setGeminiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }}
                  style={styles.input}
                  id="gemini-api-key-input"
                />
              </div>
            )}

            {/* COMPRESS options */}
            {toolId === 'compress' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ ...styles.settingGroup, flex: 1 }}>
                  <label style={styles.label}>Target Size:</label>
                  <input
                    type="number"
                    min="1"
                    value={targetSize}
                    onChange={(e) => setTargetSize(parseFloat(e.target.value) || 0)}
                    style={styles.input}
                    id="target-size-input"
                  />
                </div>
                <div style={{ ...styles.settingGroup, width: '90px' }}>
                  <label style={styles.label}>Unit:</label>
                  <select value={targetUnit} onChange={(e) => setTargetUnit(e.target.value as any)} style={styles.select} id="target-unit-select">
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
              </div>
            )}

            {/* WATERMARK options */}
            {toolId === 'watermark' && (
              <>
                <div style={styles.settingGroup}>
                  <label style={styles.label}>Watermark Text:</label>
                  <input
                    type="text"
                    placeholder="e.g. CONFIDENTIAL"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    style={styles.input}
                    id="watermark-text-input"
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <div style={{ ...styles.settingGroup, flex: 1 }}>
                    <label style={styles.label}>Font Size:</label>
                    <input type="number" min="12" max="80" value={watermarkFontSize} onChange={(e) => setWatermarkFontSize(parseInt(e.target.value, 10) || 40)} style={styles.input} />
                  </div>
                  <div style={{ ...styles.settingGroup, flex: 1 }}>
                    <label style={styles.label}>Opacity (0.05–1):</label>
                    <input type="number" min="0.05" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} style={styles.input} />
                  </div>
                </div>
              </>
            )}

            {/* SPLIT options */}
            {toolId === 'split' && (
              <>
                <div style={styles.settingGroup}>
                  <label style={styles.label}>Split Mode:</label>
                  <select value={splitMode} onChange={(e) => setSplitMode(e.target.value as any)} style={styles.select}>
                    <option value="all">Every Page (one PDF per page)</option>
                    <option value="half">Split in Half (2 parts)</option>
                    <option value="range">Custom Page Ranges</option>
                  </select>
                </div>
                {splitMode === 'range' && (
                  <div style={{ ...styles.settingGroup, marginTop: '10px' }}>
                    <label style={styles.label}>Page Ranges (e.g. "1-3,4-6,7"):</label>
                    <input type="text" placeholder="1-3,4-6,7" value={pageRanges} onChange={(e) => setPageRanges(e.target.value)} style={styles.input} />
                  </div>
                )}
              </>
            )}

            {/* ROTATE options */}
            {toolId === 'rotate' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ ...styles.settingGroup, flex: 1 }}>
                  <label style={styles.label}>Rotation Angle:</label>
                  <select value={rotateAngle} onChange={(e) => setRotateAngle(e.target.value)} style={styles.select}>
                    <option value="90">90° Clockwise</option>
                    <option value="180">180° (Upside Down)</option>
                    <option value="270">270° (Counter-Clockwise)</option>
                  </select>
                </div>
                <div style={{ ...styles.settingGroup, flex: 1 }}>
                  <label style={styles.label}>Pages:</label>
                  <input type="text" placeholder="all  OR  1,3,5" value={rotatePages} onChange={(e) => setRotatePages(e.target.value)} style={styles.input} />
                  <small style={styles.hint}>Use "all" or comma-separated page numbers</small>
                </div>
              </div>
            )}

            {/* REMOVE PAGES options */}
            {toolId === 'remove-pages' && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>Pages to Remove (e.g. "1,3,5"):</label>
                <input type="text" placeholder="1,3,5" value={pageNumbers} onChange={(e) => setPageNumbers(e.target.value)} style={styles.input} />
                <small style={styles.hint}>Comma-separated 1-indexed page numbers</small>
              </div>
            )}

            {/* EXTRACT PAGES options */}
            {toolId === 'extract-pages' && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>Pages to Extract (e.g. "1-3,5,7-9"):</label>
                <input type="text" placeholder="1-3,5,7-9" value={extractPageRanges} onChange={(e) => setExtractPageRanges(e.target.value)} style={styles.input} />
                <small style={styles.hint}>Use ranges (1-3) or individual pages (5), comma-separated</small>
              </div>
            )}

            {/* ORGANIZE PDF options */}
            {toolId === 'organize-pdf' && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>New Page Order (e.g. "3,1,2" for 3-page PDF):</label>
                <input type="text" placeholder="Leave empty to reverse pages" value={pageOrder} onChange={(e) => setPageOrder(e.target.value)} style={styles.input} />
                <small style={styles.hint}>Comma-separated 1-indexed page numbers in desired order. Empty = reverse all.</small>
              </div>
            )}

            {/* PAGE NUMBERS options */}
            {toolId === 'page-numbers' && (
              <>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ ...styles.settingGroup, flex: 2 }}>
                    <label style={styles.label}>Position:</label>
                    <select value={pageNumPosition} onChange={(e) => setPageNumPosition(e.target.value)} style={styles.select}>
                      <option value="bottom-center">Bottom Center</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="top-center">Top Center</option>
                      <option value="top-left">Top Left</option>
                      <option value="top-right">Top Right</option>
                    </select>
                  </div>
                  <div style={{ ...styles.settingGroup, flex: 1 }}>
                    <label style={styles.label}>Start Number:</label>
                    <input type="number" min="0" value={pageNumStart} onChange={(e) => setPageNumStart(parseInt(e.target.value, 10) || 1)} style={styles.input} />
                  </div>
                </div>
                <div style={{ ...styles.settingGroup, marginTop: '10px' }}>
                  <label style={styles.label}>Prefix (optional, e.g. "Page "):</label>
                  <input type="text" placeholder="Page " value={pageNumPrefix} onChange={(e) => setPageNumPrefix(e.target.value)} style={styles.input} />
                </div>
              </>
            )}

            {/* PROTECT options */}
            {toolId === 'protect' && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>Security Note (optional visual label):</label>
                <input type="text" placeholder="CONFIDENTIAL" value={protectPassword} onChange={(e) => setProtectPassword(e.target.value)} style={styles.input} />
                <small style={styles.hint}>⚠️ Note: Full AES password encryption requires a server binary. This tool applies a visible security stamp.</small>
              </div>
            )}

            {/* AI Summarizer format */}
            {toolId === 'ai-summarizer' && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>Summary Format:</label>
                <select value={summaryFormat} onChange={(e) => setSummaryFormat(e.target.value as any)} style={styles.select} id="summary-format-select">
                  <option value="bullets">Key Bullet Points</option>
                  <option value="paragraph">Fluid Narrative Summary</option>
                </select>
              </div>
            )}

            {/* Translate language */}
            {toolId === 'translate' && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>Target Language:</label>
                <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} style={styles.select} id="target-language-select">
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Italian">Italian</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Chinese">Chinese (Simplified)</option>
                  <option value="Korean">Korean</option>
                  <option value="Russian">Russian</option>
                </select>
              </div>
            )}

            {/* No-op message for tools with no options */}
            {!isIntelligence &&
              !['compress', 'watermark', 'split', 'rotate', 'remove-pages', 'extract-pages',
                'organize-pdf', 'page-numbers', 'protect', 'ai-summarizer', 'translate'].includes(toolId) && (
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0' }}>No additional options required for this tool.</p>
            )}
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              </div>
              <div style={styles.progressText}>Processing... {progress}%</div>
            </div>
          )}

          {/* Process Button */}
          {!isProcessing && (
            <button onClick={handleTriggerProcess} style={styles.processBtn} id="process-btn">
              ⚡ Process &amp; Download
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div style={styles.errorContainer}>
          <span style={styles.errorText}>⚠️ {errorMessage}</span>
        </div>
      )}
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '660px',
    margin: '20px auto',
    padding: '30px',
    backgroundColor: '#0b1329',
    borderRadius: '16px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    color: '#f8fafc',
    fontFamily: '"Outfit", "Inter", sans-serif',
  },
  header: {
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '20px',
    color: '#60a5fa',
    textAlign: 'center',
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    borderWidth: '2px',
    borderStyle: 'dashed',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  uploadIcon: { marginBottom: '16px' },
  dropText: { fontSize: '16px', fontWeight: 500, color: '#94a3b8', marginBottom: '8px' },
  browseText: { color: '#3b82f6', fontWeight: 600, textDecoration: 'underline' },
  subText: { fontSize: '12px', color: '#64748b', margin: '2px 0' },
  fileListContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  fileListHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#94a3b8' },
  clearBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
  addMoreBtn: { background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
  fileGrid: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' },
  fileCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' },
  fileInfo: { display: 'flex', alignItems: 'center', overflow: 'hidden' },
  fileName: { fontSize: '14px', fontWeight: 500, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileActions: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  fileSize: { fontSize: '12px', color: '#64748b' },
  removeBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', lineHeight: 1 },
  settingsPanel: { padding: '16px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' },
  settingsTitle: { fontSize: '14px', fontWeight: 600, color: '#60a5fa', margin: '0 0 4px 0' },
  settingGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', color: '#94a3b8', fontWeight: 500 },
  hint: { fontSize: '11px', color: '#475569', marginTop: '2px' },
  select: { padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '14px', cursor: 'pointer' },
  input: { padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '14px' },
  progressContainer: { marginTop: '4px' },
  progressBar: { height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.4s ease-in-out' },
  progressText: { fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '6px' },
  processBtn: { padding: '13px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '16px', cursor: 'pointer', transition: 'background-color 0.2s ease', textAlign: 'center', width: '100%', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' },
  errorContainer: { marginTop: '16px', padding: '10px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px' },
  errorText: { fontSize: '13px', color: '#fca5a5' },
};
