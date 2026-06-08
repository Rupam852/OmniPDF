import React, { useState, useRef, DragEvent } from 'react';

interface FileUploadZoneProps {
  toolName: string; // e.g. "Merge PDF", "AI Summarizer", "Compress PDF"
  acceptedMimeTypes?: string[];
  allowMultiple?: boolean;
  isIntelligence?: boolean;
  onProcess: (files: File[], options: Record<string, any>) => Promise<void>;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  toolName,
  acceptedMimeTypes = ['application/pdf'],
  allowMultiple = true,
  isIntelligence = false,
  onProcess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Custom tool-specific settings states
  const [targetSize, setTargetSize] = useState<number>(500);
  const [targetUnit, setTargetUnit] = useState<'KB' | 'MB'>('KB');
  const [watermarkText, setWatermarkText] = useState('');
  const [summaryFormat, setSummaryFormat] = useState<'bullets' | 'paragraph'>('bullets');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const validFiles = droppedFiles.filter(f => acceptedMimeTypes.includes(f.type));
      if (validFiles.length === 0) {
        setErrorMessage('Invalid file type. Please upload a valid PDF document.');
        return;
      }

      // Validate size limit (10MB)
      const maxLimit = 10 * 1024 * 1024;
      const tooLarge = validFiles.find(f => f.size > maxLimit);
      if (tooLarge) {
        setErrorMessage(`File "${tooLarge.name}" is too large. Maximum allowed size is 10MB.`);
        return;
      }
      
      if (!allowMultiple) {
        setFiles([validFiles[0]]);
      } else {
        setFiles(prev => [...prev, ...validFiles]);
      }
      setErrorMessage(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files);

      // Validate size limit (10MB)
      const maxLimit = 10 * 1024 * 1024;
      const tooLarge = selectedFiles.find(f => f.size > maxLimit);
      if (tooLarge) {
        setErrorMessage(`File "${tooLarge.name}" is too large. Maximum allowed size is 10MB.`);
        return;
      }

      if (!allowMultiple) {
        setFiles([selectedFiles[0]]);
      } else {
        setFiles(prev => [...prev, ...selectedFiles]);
      }
      setErrorMessage(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    setErrorMessage(null);
  };

  const handleTriggerProcess = async () => {
    if (files.length === 0) {
      setErrorMessage('Please select at least one file to process.');
      return;
    }

    if (isIntelligence && !geminiKey.trim()) {
      setErrorMessage('A Google Gemini API key must be provided to use this tool.');
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setErrorMessage(null);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 15;
      });
    }, 400);

    try {
      const options = {
        targetSize,
        targetUnit,
        watermarkText,
        summaryFormat,
        geminiKey,
        targetLanguage,
      };
      await onProcess(files, options);
      setProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    } catch (err: any) {
      clearInterval(interval);
      setIsProcessing(false);
      setProgress(0);
      setErrorMessage(err.message || 'Operation failed. Please try again.');
    }
  };

  return (
    <div className="omnipdf-upload-container" style={styles.container}>
      <h2 style={styles.header}>{toolName}</h2>
      
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
          <input
            ref={fileInputRef}
            type="file"
            multiple={allowMultiple}
            accept={acceptedMimeTypes.join(',')}
            onChange={handleFileInput}
            style={{ display: 'none' }}
            id="file-input-element"
          />
          <div style={styles.uploadIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p style={styles.dropText}>
            Drag & drop files here, or <span style={styles.browseText}>browse</span>
          </p>
          <p style={styles.subText}>Supports PDFs up to 10MB</p>
        </div>
      ) : (
        <div style={styles.fileListContainer}>
          <div style={styles.fileListHeader}>
            <span>Selected Files ({files.length})</span>
            <button onClick={clearFiles} style={styles.clearBtn}>Clear All</button>
          </div>
          
          <div style={styles.fileGrid}>
            {files.map((file, index) => (
              <div key={index} style={styles.fileCard}>
                <div style={styles.fileInfo}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ marginRight: '8px' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={styles.fileName} title={file.name}>
                    {file.name.length > 20 ? `${file.name.slice(0, 12)}...${file.name.slice(-6)}` : file.name}
                  </span>
                </div>
                <div style={styles.fileActions}>
                  <span style={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button onClick={() => removeFile(index)} style={styles.removeBtn}>&times;</button>
                </div>
              </div>
            ))}
          </div>

          {/* Option Settings Drawer based on Active Tool */}
          <div style={styles.settingsPanel}>
            <h4 style={styles.settingsTitle}>Options Configurator</h4>
            
            {isIntelligence && (
              <div style={{ ...styles.settingGroup, marginBottom: '12px' }}>
                <label style={styles.label}>Google Gemini API Key:</label>
                <input
                  type="password"
                  placeholder="Enter your Gemini API Key..."
                  value={geminiKey}
                  onChange={(e) => {
                    setGeminiKey(e.target.value);
                    localStorage.setItem('gemini_api_key', e.target.value);
                  }}
                  style={styles.input}
                  id="gemini-api-key-input"
                />
              </div>
            )}

             {toolName.includes('Compress') && (
               <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                 <div style={{ ...styles.settingGroup, flex: 1 }}>
                   <label style={styles.label}>Target Compression Size:</label>
                   <input
                     type="number"
                     min="1"
                     value={targetSize}
                     onChange={(e) => setTargetSize(parseFloat(e.target.value) || 0)}
                     style={styles.input}
                     id="target-size-input"
                   />
                 </div>
                 <div style={{ ...styles.settingGroup, width: '100px' }}>
                   <label style={styles.label}>Unit:</label>
                   <select
                     value={targetUnit}
                     onChange={(e) => setTargetUnit(e.target.value as any)}
                     style={styles.select}
                     id="target-unit-select"
                   >
                     <option value="KB">KB</option>
                     <option value="MB">MB</option>
                   </select>
                 </div>
               </div>
             )}

            {toolName.includes('Watermark') && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>Watermark Plaintext:</label>
                <input
                  type="text"
                  placeholder="e.g. CONFIDENTIAL"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  style={styles.input}
                  id="watermark-text-input"
                />
              </div>
            )}

            {toolName.includes('AI') && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>AI Summary Format:</label>
                <select 
                  value={summaryFormat} 
                  onChange={(e) => setSummaryFormat(e.target.value as any)}
                  style={styles.select}
                  id="summary-format-select"
                >
                  <option value="bullets">Key Bullet Points</option>
                  <option value="paragraph">Fluid Narrative Summary</option>
                </select>
              </div>
            )}

            {toolName.includes('Translate') && (
              <div style={styles.settingGroup}>
                <label style={styles.label}>Target Language:</label>
                <select 
                  value={targetLanguage} 
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  style={styles.select}
                  id="target-language-select"
                >
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Italian">Italian</option>
                  <option value="Portuguese">Portuguese</option>
                </select>
              </div>
            )}
          </div>

          {/* Progress Indicator */}
          {isProcessing && (
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              </div>
              <div style={styles.progressText}>Processing File: {progress}%</div>
            </div>
          )}

          {/* Trigger Button */}
          {!isProcessing && (
            <button onClick={handleTriggerProcess} style={styles.processBtn}>
              Process and Download
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div style={styles.errorContainer}>
          <span style={styles.errorText}>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

// Premium dark-blue glassmorphism styling
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '640px',
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
  uploadIcon: {
    marginBottom: '16px',
  },
  dropText: {
    fontSize: '16px',
    fontWeight: 500,
    color: '#94a3b8',
    marginBottom: '8px',
  },
  browseText: {
    color: '#3b82f6',
    fontWeight: 600,
    textDecoration: 'underline',
  },
  subText: {
    fontSize: '12px',
    color: '#64748b',
  },
  fileListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  fileListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#94a3b8',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
  },
  fileGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '180px',
    overflowY: 'auto',
  },
  fileCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
  },
  fileName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#f1f5f9',
  },
  fileActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fileSize: {
    fontSize: '12px',
    color: '#64748b',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  settingsPanel: {
    padding: '16px',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  settingsTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#60a5fa',
    margin: '0 0 12px 0',
  },
  settingGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 500,
  },
  select: {
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '14px',
    cursor: 'pointer',
  },
  input: {
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '14px',
  },
  progressContainer: {
    marginTop: '10px',
  },
  progressBar: {
    height: '6px',
    backgroundColor: '#1e293b',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease-in-out',
  },
  progressText: {
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: '6px',
  },
  processBtn: {
    padding: '12px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: '16px',
    padding: '10px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeft: '4px solid #ef4444',
    borderRadius: '4px',
  },
  errorText: {
    fontSize: '14px',
    color: '#fca5a5',
  },
};
