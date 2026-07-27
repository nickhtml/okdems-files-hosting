/**
 * @file src/components/PdfViewerPage.tsx
 * @description Embedded PDF Viewer component rendered at host.okdems.org/FILESLUG.
 * Renders the requested document inside a responsive PDF viewport framed by a clean Democratic blue theme.
 */

import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, Share2, Check, AlertCircle, FileText, Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { PdfDocument } from '../types';
import { getFirestorePdfBySlug } from '../lib/firestoreStore';
import { getLocalStoragePdfs } from '../lib/pdfStore';
import { getPdfBinary, base64ToBlobUrl } from '../lib/pdfStorageHelper';

interface PdfViewerPageProps {
  slug: string;
}

function dataUriToBlobUrl(dataUri: string): string | null {
  try {
    const parts = dataUri.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    return URL.createObjectURL(blob);
  } catch (_e) {
    return null;
  }
}

export const PdfViewerPage: React.FC<PdfViewerPageProps> = ({ slug }) => {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [overrideRawUrl, setOverrideRawUrl] = useState<string | null>(null);

  const fetchDocument = async () => {
    setLoading(true);
    setError(null);
    setOverrideRawUrl(null);

    let docData: PdfDocument | null = null;
    let base64Uri: string | null = null;

    // 1. Try Express API
    try {
      const res = await fetch(`/api/pdfs/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.document) {
          docData = data.document;
        }
      }
    } catch (_err) {
      console.warn('API call failed, falling back to Firestore');
    }

    // 2. Try Firestore Direct lookup
    try {
      const fsDoc = await getFirestorePdfBySlug(slug);
      if (fsDoc) {
        if (!docData) docData = fsDoc;
        if (fsDoc.pdfBase64) {
          base64Uri = fsDoc.pdfBase64;
        }
      }
    } catch (_e) {
      console.error('Firestore lookup failed');
    }

    // 3. Try LocalStorage backup
    if (!docData) {
      try {
        const localDocs = getLocalStoragePdfs();
        const found = localDocs.find((d) => d.slug.toLowerCase() === slug.toLowerCase() || d.slug.toLowerCase().replace(/_/g, '-') === slug.toLowerCase().replace(/_/g, '-'));
        if (found) docData = found;
      } catch (_e) {
        // Ignore
      }
    }

    // 4. Try client IndexedDB/LocalStorage binary store
    try {
      const storedBinary = await getPdfBinary(slug);
      if (storedBinary) {
        base64Uri = storedBinary;
      }
    } catch (_e) {
      // Ignore
    }

    if (docData) {
      setDoc(docData);

      const effectiveBase64 = docData.pdfBase64 || docData.fileDataUri || base64Uri;

      if (effectiveBase64) {
        const blobUrl = base64ToBlobUrl(effectiveBase64);
        if (blobUrl) {
          setOverrideRawUrl(blobUrl);
        }
      } else {
        // Fetch raw pdf endpoint or attempt to fetch stream
        try {
          const rawRes = await fetch(`/api/pdfs/raw/${encodeURIComponent(slug)}`);
          if (rawRes.ok) {
            const blob = await rawRes.blob();
            if (blob && blob.size > 0 && blob.type.includes('pdf')) {
              const blobUrl = URL.createObjectURL(blob);
              setOverrideRawUrl(blobUrl);
            }
          }
        } catch (_e) {
          // Fallback handled by direct URL
        }
      }

      setLoading(false);
      return;
    }

    setError('Document not found');
    setDoc(null);
    setLoading(false);
  };

  useEffect(() => {
    if (slug) {
      fetchDocument();
    }
  }, [slug]);

  useEffect(() => {
    if (doc) {
      document.title = `${doc.title} | OKDEMS File Hosting`;
    } else if (error) {
      document.title = `Document Not Found | OKDEMS File Hosting`;
    } else {
      document.title = `Loading Document... | OKDEMS File Hosting`;
    }
  }, [doc, error]);

  const rawPdfUrl = overrideRawUrl || `/api/pdfs/raw/${encodeURIComponent(slug)}`;
  const fullPublicUrl = `${window.location.origin}/${slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullPublicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0047AB] text-slate-900 flex flex-col justify-center items-center p-6">
        <div className="flex flex-col items-center gap-3 bg-white p-8 rounded-2xl shadow-2xl">
          <RefreshCw className="h-8 w-8 text-[#0047AB] animate-spin" />
          <p className="text-slate-800 font-bold text-sm">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-[#0047AB] text-slate-900 flex flex-col justify-center items-center p-6 text-center select-none font-sans">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-white/20 p-8">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black text-xs mx-auto mb-4 border border-red-100">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Document Unavailable</h2>
          <p className="text-slate-600 text-xs mb-6 leading-relaxed">
            The requested document <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[#0047AB] font-bold">/{slug}</span> was not found or may have been updated.
          </p>
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
            For questions or support, contact{' '}
            <a href="mailto:digitools@okdemocrats.org" className="text-[#0047AB] underline font-bold">
              digitools@okdemocrats.org
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0047AB] text-slate-900 flex flex-col font-sans p-2 sm:p-4">
      <div className="w-full max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20 flex flex-col flex-1 my-auto">
        {/* PDF Header Controls */}
        <header className="border-b border-slate-100 px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 border border-red-100">
              PDF
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-bold text-slate-900 truncate" title={doc.title}>
                {doc.title}
              </h1>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                host.okdems.org/<span className="text-[#0047AB] font-bold">{doc.slug}</span>
              </p>
            </div>
          </div>

          {/* View Actions */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs gap-1 shadow-sm">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                className="p-1 text-slate-600 hover:text-[#0047AB] rounded focus:outline-none"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center font-mono font-bold text-slate-700">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                className="p-1 text-slate-600 hover:text-[#0047AB] rounded focus:outline-none"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
              title="Copy Public Link"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied Link' : 'Share Link'}</span>
            </button>

            <a
              href={rawPdfUrl}
              download={doc.originalName}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-[#0047AB] hover:bg-blue-800 text-white rounded-lg shadow transition-colors"
              title="Download PDF File"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            <a
              href={rawPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition-colors"
              title="Open PDF in New Tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition-colors hidden md:block"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Embedded PDF Canvas Container */}
        <main className="flex-1 p-2 md:p-4 bg-slate-100 flex flex-col items-center justify-center">
          <div
            className="w-full flex-1 bg-white rounded-xl overflow-hidden shadow border border-slate-200 flex flex-col transition-all"
            style={{ minHeight: 'calc(100vh - 140px)' }}
          >
            {/* Main PDF Object Embed with iFrame Fallback */}
            <object
              data={rawPdfUrl.startsWith('blob:') ? rawPdfUrl : `${rawPdfUrl}#view=FitH&zoom=${zoomLevel}`}
              type="application/pdf"
              className="w-full flex-1 border-0 rounded-xl"
              style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 150px)' }}
            >
              <iframe
                src={rawPdfUrl.startsWith('blob:') ? rawPdfUrl : `${rawPdfUrl}#view=FitH&zoom=${zoomLevel}`}
                className="w-full flex-1 border-0 rounded-xl"
                title={doc.title}
                style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 150px)' }}
              >
                <div className="text-center p-8 text-slate-600 flex flex-col items-center justify-center h-full">
                  <FileText className="h-12 w-12 text-[#0047AB] mb-3 opacity-60" />
                  <p className="font-bold text-slate-800 text-sm mb-1">Inline PDF Preview</p>
                  <p className="text-xs text-slate-500 mb-4">
                    Your device or browser doesn't support direct inline rendering.
                  </p>
                  <a
                    href={rawPdfUrl}
                    download={doc.originalName}
                    className="px-4 py-2 bg-[#0047AB] text-white rounded-lg text-xs font-bold shadow hover:bg-blue-800 transition-colors"
                  >
                    Download PDF File
                  </a>
                </div>
              </iframe>
            </object>
          </div>
        </main>
      </div>
    </div>
  );
};
