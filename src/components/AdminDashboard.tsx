/**
 * @file src/components/AdminDashboard.tsx
 * @description Main document management portal at host.okdems.org/admin.
 * Allows verified @okdemocrats.org users to drag-and-drop upload PDFs, define custom file slugs,
 * monitor document view metrics, manage direct links, and generate embed codes.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Link,
  Copy,
  Trash2,
  ExternalLink,
  LogOut,
  Search,
  Check,
  Code,
  Eye,
  Download,
  AlertCircle,
  PlusCircle,
  FilePlus,
  RefreshCw,
  BarChart3,
  HardDrive
} from 'lucide-react';
import { PdfDocument, UserSession } from '../types';
import { generateSlug, formatFileSize } from '../lib/pdfStore';
import { EmbedModal } from './EmbedModal';
import { getFirestorePdfs, saveFirestorePdf, deleteFirestorePdf } from '../lib/firestoreStore';

interface AdminDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ session, onLogout }) => {
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState<string>('');
  const [slugInput, setSlugInput] = useState<string>('');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Active Modals & Clipboard state
  const [activeEmbedDoc, setActiveEmbedDoc] = useState<PdfDocument | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents from Express backend with Firestore fallback
  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/pdfs');
      if (res.ok) {
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
          setDocuments(data.documents);
          setLoading(false);
          return;
        }
      }
    } catch (_err) {
      console.warn('Backend API unavailable, using Firestore direct store');
    }

    // Firestore fallback
    try {
      const fsDocs = await getFirestorePdfs();
      setDocuments(fsDocs);
    } catch (_e) {
      console.error('Failed to load PDF directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Auto-generate clean slug from title input if user hasn't explicitly edited slug
  const handleTitleChange = (val: string) => {
    setTitleInput(val);
    if (!slugInput || slugInput === generateSlug(titleInput)) {
      setSlugInput(generateSlug(val));
    }
  };

  // Handle File Select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setUploadError('Only PDF documents (.pdf) are accepted.');
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
      if (!titleInput) {
        const cleanTitle = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ');
        setTitleInput(cleanTitle);
        setSlugInput(generateSlug(cleanTitle));
      }
    }
  };

  // Helper to convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle Form Submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!selectedFile) {
      setUploadError('Please select a PDF document file to upload.');
      return;
    }

    if (!titleInput.trim()) {
      setUploadError('Document title is required.');
      return;
    }

    const cleanSlug = generateSlug(slugInput || titleInput);
    if (!cleanSlug) {
      setUploadError('Invalid URL slug. Please use alphanumeric characters and hyphens.');
      return;
    }

    setUploading(true);

    try {
      const base64Content = await fileToBase64(selectedFile);
      const docId = `doc-${Date.now()}`;
      const newDoc: PdfDocument = {
        id: docId,
        title: titleInput.trim(),
        slug: cleanSlug,
        filename: `${docId}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
        originalName: selectedFile.name,
        fileSize: selectedFile.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: session.email || 'digitools@okdemocrats.org',
        views: 0,
        description: descriptionInput.trim() || undefined
      };

      let fsSuccess = false;
      let apiSuccess = false;
      let apiErrorMsg = '';

      // 1. Try Express API upload
      try {
        const formData = new FormData();
        formData.append('pdf', selectedFile);
        formData.append('title', titleInput.trim());
        formData.append('slug', cleanSlug);
        formData.append('description', descriptionInput.trim());
        formData.append('uploaderEmail', session.email || 'digitools@okdemocrats.org');

        const apiRes = await fetch('/api/pdfs/upload', {
          method: 'POST',
          body: formData
        });
        if (apiRes.ok) {
          apiSuccess = true;
        } else {
          const errData = await apiRes.json().catch(() => ({}));
          apiErrorMsg = errData.error || errData.message || `Server returned status ${apiRes.status}`;
        }
      } catch (_e) {
        // Express backend route might not be available or fail
      }

      // 2. Save to Firestore for permanent cross-instance persistence
      try {
        fsSuccess = await saveFirestorePdf(newDoc, base64Content);
      } catch (fsErr: any) {
        console.warn('Firestore upload note:', fsErr);
      }

      if (fsSuccess || apiSuccess) {
        setUploadSuccess(`PDF published successfully at host.okdems.org/${newDoc.slug}`);
        setSelectedFile(null);
        setTitleInput('');
        setSlugInput('');
        setDescriptionInput('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchDocuments();
      } else {
        setUploadError(apiErrorMsg || 'Error uploading PDF document. Please try again.');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Error processing PDF document upload.');
    } finally {
      setUploading(false);
    }
  };

  // Handle Document Delete
  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this hosted PDF? Public links to this slug will no longer work.')) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteFirestorePdf(id);
      try {
        await fetch(`/api/pdfs/${id}`, { method: 'DELETE' });
      } catch (_e) {
        // Ignore API error
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (_err) {
      alert('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyLink = (slug: string) => {
    const fullUrl = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  // Filtered documents list
  const filteredDocs = documents.filter((doc) => {
    const q = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.slug.toLowerCase().includes(q) ||
      (doc.description && doc.description.toLowerCase().includes(q))
    );
  });

  const totalViews = documents.reduce((sum, d) => sum + d.views, 0);
  const totalStorage = documents.reduce((sum, d) => sum + d.fileSize, 0);

  return (
    <div className="min-h-screen bg-[#0047AB] text-slate-900 flex flex-col font-sans p-2 sm:p-6">
      <div className="max-w-7xl w-full mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20 flex flex-col my-auto min-h-[90vh]">
        {/* Header */}
        <header className="border-b border-slate-100 px-6 md:px-8 py-5 flex flex-wrap justify-between items-center bg-slate-50 gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0047AB] tracking-tight flex items-center gap-2">
              <span className="bg-[#0047AB] text-white px-2.5 py-0.5 rounded-lg text-sm font-black">OKDEMS</span>
              PDF HOST
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-bold">host.okdems.org/admin</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-700">{session.email}</p>
                <div className="flex items-center justify-end gap-1">
                  <Check className="w-3 h-3 text-blue-600 stroke-[3]" />
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Google Verified</span>
                </div>
              </div>
              <div className="h-8 w-8 bg-[#0047AB] rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                {session.email.charAt(0).toUpperCase()}
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-full border border-slate-200 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Dashboard Content Body */}
        <main className="flex-1 p-6 md:p-8 bg-white space-y-8">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 bg-blue-50 text-[#0047AB] rounded-xl flex items-center justify-center font-bold">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">{documents.length}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Hosted PDF Files</p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">{totalViews}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Document Views</p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
                <HardDrive className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">{formatFileSize(totalStorage)}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Storage Utilized</p>
              </div>
            </div>
          </div>

          {/* Upload Section */}
          <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Upload className="h-5 w-5 text-[#0047AB]" />
                Upload New PDF Document
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">host.okdems.org</span>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 mb-4 text-xs flex items-center gap-2 font-medium">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-[#0047AB] rounded-2xl p-6 text-center bg-white transition-all cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload-input"
                />
                <label htmlFor="pdf-upload-input" className="cursor-pointer block">
                  <div className="w-12 h-12 bg-blue-50 text-[#0047AB] rounded-xl flex items-center justify-center mx-auto mb-2">
                    <FilePlus className="h-6 w-6" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-600">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-700">Click to select PDF or drag file here</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">PDF documents up to 50MB supported</p>
                    </div>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Official 2026 Voter Guide"
                    required
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-blue-100 focus:border-[#0047AB] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Custom Slug *
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-mono text-slate-400 select-none">host.okdems.org/</span>
                    <input
                      type="text"
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value)}
                      placeholder="voter-guide-2026"
                      required
                      className="w-full pl-36 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-blue-600 font-mono text-xs focus:ring-2 focus:ring-blue-100 focus:border-[#0047AB] focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <input
                  type="text"
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Optional notes or summary..."
                  className="flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-blue-100 focus:border-[#0047AB] focus:outline-none transition-all"
                />

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="bg-[#0047AB] hover:bg-blue-800 text-white rounded-xl py-2.5 px-6 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-900/10 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4" />
                      <span>Publish PDF</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Directory Section */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Managed Documents</h2>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter slugs or titles..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400 font-mono text-xs">Loading document directory...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold">No documents matching filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredDocs.map((doc) => {
                  const publicUrl = `${window.location.origin}/${doc.slug}`;
                  const isCopied = copiedSlug === doc.slug;

                  return (
                    <div
                      key={doc.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center p-5 border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/20 transition-all gap-4 group shadow-sm bg-white"
                    >
                      {/* Clean Minimalism Red PDF Icon Box */}
                      <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 shadow-sm border border-red-100">
                        PDF
                      </div>

                      {/* Info Column */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{doc.title}</h3>
                        <p className="text-xs text-[#0047AB] font-mono mt-0.5 tracking-tight font-semibold truncate">
                          host.okdems.org/{doc.slug}
                        </p>
                        {doc.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{doc.description}</p>}
                      </div>

                      {/* Views & Size */}
                      <div className="text-right sm:mr-4">
                        <p className="text-xs font-bold text-slate-800">{doc.views.toLocaleString()} views</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">{formatFileSize(doc.fileSize)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                        <button
                          onClick={() => handleCopyLink(doc.slug)}
                          className="p-2 text-slate-500 hover:text-[#0047AB] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Copy Public Link"
                        >
                          {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>

                        <button
                          onClick={() => setActiveEmbedDoc(doc)}
                          className="p-2 text-slate-500 hover:text-[#0047AB] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Get iFrame Embed Code"
                        >
                          <Code className="h-4 w-4" />
                        </button>

                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-500 hover:text-[#0047AB] hover:bg-blue-50 rounded-lg transition-colors"
                          title="View PDF"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>

                        <a
                          href={`/api/pdfs/raw/${doc.slug}`}
                          download={doc.originalName}
                          className="p-2 text-slate-500 hover:text-[#0047AB] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download File"
                        >
                          <Download className="h-4 w-4" />
                        </a>

                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={deletingId === doc.id}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete File"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-slate-400 text-[10px]">
          <p className="font-medium">You've reached a project of the OKDEMS Digital Team.</p>
          <p>
            For assistance: <a href="mailto:digitools@okdemocrats.org" className="text-blue-400 font-bold underline">digitools@okdemocrats.org</a>
          </p>
        </footer>
      </div>

      {/* Embed Modal */}
      {activeEmbedDoc && (
        <EmbedModal doc={activeEmbedDoc} onClose={() => setActiveEmbedDoc(null)} />
      )}
    </div>
  );
};
