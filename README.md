# OmniPDF

<div align="center">

![OmniPDF Banner](https://img.shields.io/badge/OmniPDF-Premium%20PDF%20Suite-3b82f6?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)

**A professional, full-stack PDF processing platform — Web + Android + Cloud Backend**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-omnipdf--converter.vercel.app-10b981?style=flat-square&logo=vercel)](https://omnipdf-converter.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Flutter](https://img.shields.io/badge/Flutter-Android-02569b?style=flat-square&logo=flutter)](https://flutter.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org)

</div>

---

## 📖 Overview

**OmniPDF** is a premium, full-stack document processing platform offering **20+ PDF tools** through a modern web interface and native Android application. It features a decoupled cloud architecture with a Node.js/Express backend, Python processing scripts, and a WebAssembly-powered browser compression engine.

### Why OmniPDF?
- ⚡ **Zero wait** — Common operations (compress, merge, split) run directly in the browser
- 🔒 **Privacy-first** — No files are stored on any server; in-memory only, deleted after download
- 🌐 **Cross-platform** — Works on web (any browser) and Android devices
- 🤖 **AI-powered** — OCR and document summarization via Google Gemini API

---

## ✨ Features

### 📂 Organize PDF
| Tool | Description |
|------|-------------|
| Merge PDF | Combine multiple PDFs into one document in any order |
| Split PDF | Separate pages into individual files or custom ranges |
| Remove Pages | Delete specific pages from any PDF |
| Extract Pages | Export a page range as a clean new PDF |
| Organize PDF | Reorder pages with drag-and-drop interface |

### ⚙️ Optimize PDF
| Tool | Description |
|------|-------------|
| Compress PDF | Reduce file size up to 90% using in-browser WebAssembly |
| Repair PDF | Attempt recovery of corrupted or malformed PDFs |
| OCR PDF | Extract searchable text from scanned documents via AI |

### 🔄 Convert to PDF
| Tool | Description |
|------|-------------|
| JPG to PDF | Convert images to PDF documents |
| Word to PDF | Convert `.docx` files using Python/LibreOffice pipeline |
| PowerPoint to PDF | Convert `.pptx` presentations |
| Excel to PDF | Convert `.xlsx` spreadsheets |
| HTML to PDF | Render HTML pages to PDF |

### 📤 Convert from PDF
| Tool | Description |
|------|-------------|
| PDF to JPG | Extract pages as high-quality JPEG images |
| PDF to Word | Convert PDF content to editable Word documents |
| PDF to PowerPoint | Convert slides back to PowerPoint format |
| PDF to Excel | Extract tabular data to spreadsheet |
| PDF to PDF/A | Convert to archival-standard PDF/A format |

### ✏️ Edit PDF
| Tool | Description |
|------|-------------|
| Watermark PDF | Add custom text watermarks with opacity and position controls |
| Rotate PDF | Rotate pages in 90°/180°/270° increments |
| Page Numbers | Stamp page numbers with configurable font/position |
| Crop PDF | Trim and crop page margins |
| PDF Forms | Extract and process form fields |

### 🔐 PDF Security
| Tool | Description |
|------|-------------|
| Protect PDF | Password-encrypt PDFs with AES encryption |
| Unlock PDF | Remove password protection from accessible PDFs |
| Sign PDF | Add digital signature stamps to documents |
| Redact PDF | Permanently black-out sensitive text |
| Compare PDF | Side-by-side diff of two PDF versions |

### 🧠 PDF Intelligence (AI)
| Tool | Description |
|------|-------------|
| AI Summarizer | Extract key points and summaries from long documents |
| OCR PDF | Convert scanned images to searchable text (Gemini Vision) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Clients                         │
│                                                          │
│   ┌──────────────────┐      ┌────────────────────────┐  │
│   │  React Web App   │      │  Flutter Android App   │  │
│   │  (Vite + TS)     │      │  (Dart)                │  │
│   └────────┬─────────┘      └──────────┬─────────────┘  │
│            │                            │                │
│   ┌────────▼─────────┐                  │                │
│   │ Browser WASM     │                  │                │
│   │ (Compression)    │                  │                │
│   └──────────────────┘                  │                │
└───────────────────────────────┬─────────┘────────────────┘
                                │ HTTPS REST API
                    ┌───────────▼───────────────┐
                    │   Node.js + Express API   │
                    │   (TypeScript, Render)    │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │  Python Scripts     │  │
                    │  │  (PyMuPDF, docx,    │  │
                    │  │   pptx, pdf2docx,   │  │
                    │  │   Google Gemini)    │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend (`/frontend`)
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5.4 | Type safety |
| Vite | 5 | Build tool & HMR |
| Vanilla CSS | — | Styling, animations, responsive layout |
| WebAssembly | — | In-browser PDF compression |

### Backend (`/backend`)
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js + Express | 4.19 | REST API server |
| TypeScript | 5.4 | Type safety |
| Multer | 1.4 | File upload handling |
| pdf-lib | 1.17 | Server-side PDF manipulation |
| Helmet | 7.1 | Security headers |
| express-rate-limit | 7.2 | DoS & abuse protection |
| Python 3 | 3.x | PDF conversion pipeline |
| PyMuPDF (fitz) | — | PDF parsing, OCR, redaction |
| pdf2docx | — | PDF → Word conversion |
| Google Generative AI | 0.24 | AI Summarizer & OCR |

### Mobile (`/mobile`)
| Technology | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.x | Cross-platform UI |
| Dart | 3.x | App logic |
| http package | — | API communication |
| file_picker | — | Document selection |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Vercel | Frontend hosting & CI/CD |
| Render | Backend API hosting |
| GitHub | Source control & deployments trigger |

---

## 🔒 Security Architecture

| Layer | Measure |
|-------|---------|
| **CORS** | Strict origin allowlist — only `omnipdf-converter.vercel.app` |
| **Helmet** | 15 security HTTP headers (CSP, HSTS, X-Frame-Options, etc.) |
| **Rate Limiting** | API: 100 req/15min · Processing: 5 req/min · AI: 2 req/min |
| **File Validation** | MIME type whitelist — rejects executables, scripts, archives |
| **File Size Limit** | 10MB maximum upload size enforced at server level |
| **No Persistence** | All files processed in-memory, never written to permanent storage |
| **Error Masking** | Internal errors hidden in production responses |
| **Temp Cleanup** | Stale temp files (1hr+) auto-purged on server startup |

---

## 🚀 Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Python 3.9+](https://www.python.org/) with `pip`
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (only for Android app)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Rupam852/OmniPDF.git
cd OmniPDF
```

---

### 2. Setup Backend

```bash
cd backend
npm install
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Create your environment file:
```bash
# Create backend/.env with the following variables:
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
ENCRYPTION_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

Start the backend server:
```bash
npm run dev
# Server starts at http://localhost:5000
```

---

### 3. Setup Frontend

```bash
cd ../frontend
npm install
```

Create your environment file:
```bash
# Create frontend/.env with:
VITE_API_URL=http://localhost:5000/api
```

Start the development server:
```bash
npm run dev
# App opens at http://localhost:5173
```

---

### 4. Setup Android App (Optional)

```bash
cd ../mobile
flutter pub get
flutter run          # Run on connected device/emulator
flutter build apk --release   # Build production APK
```

---

## 📁 Project Structure

```
OmniPDF/
├── frontend/                   # React + Vite web application
│   ├── src/
│   │   ├── App.tsx             # Main app component & routing
│   │   ├── components/         # Reusable UI components
│   │   │   └── FileUploadZone.tsx
│   │   ├── services/           # API client & utilities
│   │   │   ├── api.ts          # Backend API client
│   │   │   └── compressPdf.ts  # WebAssembly compression
│   │   └── index.css           # Global styles & design tokens
│   └── index.html
│
├── backend/                    # Node.js + Express REST API
│   ├── src/
│   │   ├── app.ts              # Express server, CORS, middleware
│   │   ├── routes/
│   │   │   └── tools.ts        # All 20+ PDF tool endpoints
│   │   ├── middleware/
│   │   │   ├── auth.ts         # Request type definitions
│   │   │   └── rateLimiter.ts  # Rate limiting configuration
│   │   ├── scripts/            # Python processing scripts
│   │   │   ├── compress.py
│   │   │   ├── ocr.py
│   │   │   ├── redact.py
│   │   │   ├── pdf_to_word.py
│   │   │   └── ...             # 15+ more scripts
│   │   └── utils/
│   │       └── pythonSetup.ts  # Auto Python dependency installer
│   └── requirements.txt        # Python dependencies
│
└── mobile/                     # Flutter Android application
    ├── lib/
    │   └── main.dart           # App entry & tool dashboard
    └── android/                # Android native configuration
```

---

## 🌐 Deployment

### Frontend → Vercel

The frontend auto-deploys on every push to `main` via Vercel's GitHub integration.

**Required Vercel Environment Variables:**
```
VITE_API_URL = https://your-backend.onrender.com/api
```

### Backend → Render

The backend deploys on Render with the following configuration:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

**Required Render Environment Variables:**
```
NODE_ENV         = production
PORT             = 10000
ALLOWED_ORIGINS  = https://omnipdf-converter.vercel.app
ENCRYPTION_KEY   = <your-64-char-hex-key>
```

---

## 📋 API Reference

Base URL: `https://your-backend.onrender.com/api`

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/tools/merge` | Merge multiple PDFs | 5/min |
| POST | `/tools/split` | Split PDF into parts | 5/min |
| POST | `/tools/compress` | Compress PDF file | 5/min |
| POST | `/tools/protect` | Password-protect PDF | 5/min |
| POST | `/tools/unlock` | Remove PDF password | 5/min |
| POST | `/tools/watermark` | Add text watermark | 5/min |
| POST | `/tools/rotate` | Rotate PDF pages | 5/min |
| POST | `/tools/redact` | Redact sensitive text | 5/min |
| POST | `/tools/ocr` | OCR scanned PDF | **2/min** |
| POST | `/tools/ai-summarizer` | AI document summary | **2/min** |
| POST | `/tools/pdf-to-word` | Convert PDF to Word | 5/min |
| POST | `/tools/jpg-to-pdf` | Convert images to PDF | 5/min |
| POST | `/tools/compare` | Compare two PDFs | 5/min |

All endpoints accept `multipart/form-data` with file uploads.  
File size limit: **10MB per file**.  
Accepted types: PDF, JPEG, PNG, DOCX, XLSX, PPTX, HTML.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## 📧 Support

- **Website:** [omnipdf-converter.vercel.app](https://omnipdf-converter.vercel.app)
- **Support Email:** omnipdfadminsupport@gmail.com
- **Issues:** [GitHub Issues](https://github.com/Rupam852/OmniPDF/issues)

---

## 📄 License

© 2026 OmniPDF. Licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with ❤️ using React, Node.js, Python & Flutter

</div>
