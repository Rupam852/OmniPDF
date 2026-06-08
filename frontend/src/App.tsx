import { useState } from 'react';
import { FileUploadZone } from './components/FileUploadZone';
import { OmniPdfApi } from './services/api';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'organize' | 'optimize' | 'convert' | 'edit' | 'security' | 'intelligence' | 'workflow';
  iconColor: string;
  iconPath: JSX.Element;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null); // Dummy user token for layout representation

  const tabs = [
    'All',
    'Workflows',
    'Organize PDF',
    'Optimize PDF',
    'Convert PDF',
    'Edit PDF',
    'PDF Security',
    'PDF Intelligence'
  ];

  const tools: Tool[] = [
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
      id: 'pdf-to-word',
      name: 'PDF to Word',
      description: 'Easily convert your PDF files into easy to edit DOC and DOCX documents.',
      category: 'convert',
      iconColor: '#3b82f6',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
    },
    {
      id: 'ai-summarizer',
      name: 'AI Summarizer',
      description: 'Quickly generate concise summaries from articles, paragraphs, and essays using Gemini.',
      category: 'intelligence',
      iconColor: '#8b5cf6',
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
      iconColor: '#8b5cf6',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      id: 'protect',
      name: 'Protect PDF',
      description: 'Protect PDF files with a password. Encrypt PDF documents to prevent unauthorized access.',
      category: 'security',
      iconColor: '#1d4ed8',
      iconPath: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    }
  ];

  const filteredTools = tools.filter(tool => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Workflows') return tool.category === 'workflow';
    if (activeTab === 'Organize PDF') return tool.category === 'organize';
    if (activeTab === 'Optimize PDF') return tool.category === 'optimize';
    if (activeTab === 'Convert PDF') return tool.category === 'convert';
    if (activeTab === 'Edit PDF') return tool.category === 'edit';
    if (activeTab === 'PDF Security') return tool.category === 'security';
    if (activeTab === 'PDF Intelligence') return tool.category === 'intelligence';
    return true;
  });

  const handleProcessTool = async (files: File[], options: Record<string, any>) => {
    if (!selectedTool) return;
    console.log(`Processing tool ${selectedTool.id} with options`, options);

    // Call appropriate mock backend api
    if (selectedTool.id === 'merge') {
      const result = await OmniPdfApi.mergePdfs(authStatus || '', files);
      if (result.downloadUrl) {
        // Trigger browser automatic download
        window.open(result.downloadUrl, '_blank');
      }
    } else if (selectedTool.id === 'ai-summarizer') {
      const result = await OmniPdfApi.summarizePdf(authStatus || '', files[0]);
      alert(`AI Summary Result:\n\n${result.summary}`);
    } else {
      // Simulate generic download response
      setTimeout(() => {
        alert(`${selectedTool.name} task completed successfully!`);
      }, 1500);
    }
  };

  return (
    <div style={appStyles.appWrapper}>
      {/* Navigation Bar */}
      <header className="app-header">
        <a href="#" className="logo">
          Omni<span>PDF</span> AI
        </a>
        <ul className="nav-links">
          <li><a href="#" className="nav-link">MERGE PDF</a></li>
          <li><a href="#" className="nav-link">SPLIT PDF</a></li>
          <li><a href="#" className="nav-link">COMPRESS PDF</a></li>
          <li><a href="#" className="nav-link">CONVERT PDF</a></li>
          <li><a href="#" className="nav-link">ALL PDF TOOLS</a></li>
        </ul>
        <div style={appStyles.authButtons}>
          <button style={appStyles.loginBtn}>Login</button>
          <button className="btn-primary">Sign up</button>
        </div>
      </header>

      {/* Main Container */}
      <main style={appStyles.main}>
        {selectedTool ? (
          <div>
            <button onClick={() => setSelectedTool(null)} style={appStyles.backBtn}>
              &larr; Back to Tools Grid
            </button>
            <FileUploadZone
              toolName={selectedTool.name}
              allowMultiple={selectedTool.id === 'merge'}
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

      {/* Footer */}
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
};
