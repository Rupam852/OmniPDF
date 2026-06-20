# ⚡ OmniPDF — Premium Document Suite

<div align="center">

![OmniPDF Banner](https://img.shields.io/badge/OmniPDF-Premium%20PDF%20Suite-3b82f6?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)

**A professional, full-stack PDF processing suite — Web Client, Android App, and Secure Cloud API**

[![Vercel Deployment](https://img.shields.io/badge/Live%20Demo-omnipdf--converter.vercel.app-10b981?style=flat-square&logo=vercel)](https://omnipdf-converter.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Flutter](https://img.shields.io/badge/Flutter-Android-02569b?style=flat-square&logo=flutter)](https://flutter.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org)

</div>

---

## 📖 Overview

**OmniPDF** is a premium, full-stack document processing suite offering **20+ powerful PDF tools** accessible through a beautiful, responsive React workspace and a native Android application. It utilizes a decoupled, secure architecture featuring a Node.js/Express backend, Python core-processing scripts, and an in-browser WebAssembly PDF compression engine.

### Why OmniPDF?
* ⚡ **High-Speed Execution** — Standard actions (compress, merge, split) execute in seconds with WebAssembly and multi-threaded script workers.
* 🔒 **100% Account-Free Privacy** — No signup, no Firebase, and zero tracking. All files are processed entirely in-memory and instantly purged post-download.
* 📏 **Up to 15MB Combined Uploads** — Process large individual documents or execute bulk conversions sequentially under a unified 15MB size limit.
* 🤖 **AI-Powered OCR & Summarizer** — Seamlessly transcribe scans or query highlights from your PDF documents via secure Gemini 1.5 Flash integrations.

---

## ✨ Features Directory

### 📂 Organize PDF
* **Merge PDF** — Combine multiple PDFs into a single document in any custom sequence.
* **Split PDF** — Extract pages into independent files (every page, split in half, or custom ranges).
* **Remove Pages** — Delete unnecessary pages and compile the remaining clean layout.
* **Extract Pages** — Select specific indices and export them as a standalone document.
* **Organize PDF** — Instantly reverse page orientation or supply a custom index structure (e.g. `3,1,2`).

### ⚙️ Optimize PDF
* **Compress PDF** — Shave up to 90% off document size using custom WebAssembly algorithms.
* **Repair PDF** — Automatically repair malformed headers or corrupt byte streams.
* **OCR PDF (AI)** — Transcribe handwritten or typed scanned pages into copyable text.

### 🔄 Convert to PDF
* **JPG / PNG to PDF** — Batch-compile layout images into an aligned PDF binder.
* **Word to PDF** — Convert `.docx` word processing documents with active styling preservation.
* **PowerPoint to PDF** — Convert `.pptx` slides to PDF archives.
* **Excel to PDF** — Convert `.xlsx` spreadsheets to document pages.
* **HTML to PDF** — Render input HTML pages directly to PDFs.

### 📤 Convert from PDF
* **PDF to JPG** — Convert document pages into compressed JPEG image slides.
* **PDF to Word** — Export PDF layouts back to editable Word documents.
* **PDF to PowerPoint** — Export slide decks back to PPTX formatting.
* **PDF to Excel** — Parse PDF tables directly into structured spreadsheets.
* **PDF to PDF/A** — Conform to the ISO standard for long-term digital archiving.

### ✏️ Edit PDF
* **Watermark** — Overlay custom text stamps with adjustable opacity, positioning, and rotation.
* **Rotate PDF** — Reorient page spreads by 90°, 180°, or 270° increments.
* **Page Numbers** — Insert customizable pagination headers/footers.
* **Crop PDF** — Trim margins by percentage adjustments.
* **PDF Forms** — Automatically detect and flatten fillable interactive fields.

### 🔐 Security & Utilities
* **Protect PDF** — Strong AES-256 password encryption blocks unauthorized access.
* **Unlock PDF** — Strip security permissions from accessible PDFs using your password.
* **Sign PDF** — Place customized digital name signature stamps.
* **Redact PDF** — Permanently blackout sensitive keywords (e.g., SSN, passwords, emails).
* **Compare PDF** — Side-by-side versions check pointing out added/removed texts.

---

## 🏗️ Architecture Blueprint

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

### Web Workspace (`/frontend`)
* **React 18** — High-performance dynamic component tree layout.
* **TypeScript 5.4** — Enforced type safety and static error-avoidance.
* **Vite 5** — Rapid hot module replacement and production builds.
* **Vanilla CSS** — Micro-interactions, slide transitions, and responsive grid system.
* **WebAssembly** — High-efficiency local PDF compression logic.

### Cloud Server (`/backend`)
* **Node.js + Express** — Secure REST API router.
* **Multer** — Streamlines multi-file upload management.
* **pdf-lib** — Fast in-memory PDF merging and configuration.
* **PyMuPDF** — Main Python library for rendering page images, redactions, and crops.
* **pdf2docx / pdf2pptx** — High-fidelity document conversions.
* **Google Generative AI SDK** — Powers AI Summaries and OCR readings.

### Mobile Client (`/mobile`)
* **Flutter SDK 3** — Beautiful, fluid interface rendering across Android devices.
* **Dart** — Type-safe client architecture.
* **http** — Multi-part network upload communications.

---

## 🔒 Security & Data Sanitation

* **Strict CORS Rules** — Server only responds to requests originating from `omnipdf-converter.vercel.app`.
* **Helmet Protection** — Evaluates 15 secure headers (HSTS, Content Security Policy, XSS blocks).
* **Rate Limits** — REST Route Limits (100 req / 15m), processing pipelines (5 files / min), and AI API calls (2 req / min).
* **Upload Whitelist** — Discards invalid MIME formats (rejects executables, archives, scripts).
* **In-Memory Pipe** — Files are uploaded as buffers, processed in memory, and immediately deleted.
* **Auto-Purge Cron** — Any stray directory nodes are cleaned up automatically on backend restart.

---

## 🚀 Local Installation

### Prerequisites
* [Node.js](https://nodejs.org/) v18+
* [Python 3.9+](https://www.python.org/) with `pip`
* [Flutter SDK](https://docs.flutter.dev/get-started/install)

### 1. Clone & Set Up
```bash
git clone https://github.com/Rupam852/OmniPDF.git
cd OmniPDF
```

### 2. Configure Backend
```bash
cd backend
npm install
pip install -r requirements.txt
```
Create a `backend/.env` file with:
```env
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
ENCRYPTION_KEY=your_64_character_hexadecimal_encryption_key
```
Start development backend:
```bash
npm run dev
# Server running at http://localhost:5000
```

### 3. Configure Frontend
```bash
cd ../frontend
npm install
```
Create a `frontend/.env` file with:
```env
VITE_API_URL=http://localhost:5000/api
```
Start development web client:
```bash
npm run dev
# Web client opens at http://localhost:5173
```

### 4. Run Mobile App
```bash
cd ../mobile
flutter pub get
flutter run
```

---

## 📋 API Integration Index

Production URL: `https://omnipdf-backed.onrender.com/api`

| Method | Endpoint | Purpose | Limit |
|:---|:---|:---|:---|
| **POST** | `/tools/merge` | Merges array of PDF files | 5 / min |
| **POST** | `/tools/split` | Splits PDF pages into ranges | 5 / min |
| **POST** | `/tools/compress` | Compresses target document | 5 / min |
| **POST** | `/tools/protect` | Encrypts PDF (AES-256) | 5 / min |
| **POST** | `/tools/unlock` | Strips PDF credentials | 5 / min |
| **POST** | `/tools/watermark` | Adds opacity text stamp | 5 / min |
| **POST** | `/tools/rotate` | Rotates document pages | 5 / min |
| **POST** | `/tools/redact` | permanently blacks out text | 5 / min |
| **POST** | `/tools/ocr` | AI scanned OCR reader | 2 / min |
| **POST** | `/tools/ai-summarizer`| AI Summarizer module | 2 / min |
| **POST** | `/tools/pdf-to-word` | Exports PDF to docx format | 5 / min |
| **POST** | `/tools/jpg-to-pdf` | Combines images into PDF | 5 / min |
| **POST** | `/tools/compare` | Compares two PDFs (diff report) | 5 / min |

* All endpoints accept `multipart/form-data`.
* Maximum combined payload size limit: **15MB**.

---

## 📧 Contact & Support

* **Website**: [omnipdf-converter.vercel.app](https://omnipdf-converter.vercel.app)
* **Issues Tracker**: [GitHub Issues](https://github.com/Rupam852/OmniPDF/issues)
* **Support Contact**: omnipdfadminsupport@gmail.com

---

<div align="center">

© 2026 OmniPDF.  
Built with ❤️ using React, Node.js, Python & Flutter

</div>
