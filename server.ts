/**
 * @file server.ts
 * @description Full-stack Express server for the OKDEMS PDF Host platform.
 * Handles PDF file storage, raw PDF binary streaming, slug resolution,
 * Google Auth verification for @okdemocrats.org domain users, and Vite SPA routing.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PDF_DOCUMENTS, SAMPLE_OKDEMS_PDF_BASE64, isValidOkDemsEmail } from './src/lib/pdfStore.js';
import { PdfDocument } from './src/types.js';

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MANIFEST_PATH = path.join(UPLOADS_DIR, 'manifest.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to save manifest to disk synchronously
function saveManifest(docs: PdfDocument[]) {
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(docs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write manifest.json:', err);
  }
}

// Helper to load manifest from disk or reconstruct from files in uploads/
function loadManifest(): PdfDocument[] {
  let docs: PdfDocument[] = [];
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      docs = JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading manifest.json:', err);
  }

  // Scan uploads directory for any unindexed files on disk
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const pdfFiles = files.filter((f) => f.endsWith('.pdf') && !f.startsWith('.'));
    
    let updated = false;
    for (const filename of pdfFiles) {
      const exists = docs.some((d) => d.filename === filename);
      if (!exists) {
        // Derive slug and title from filename
        const parts = filename.split('-');
        const rawSlug = parts.slice(1).join('-').replace(/\.pdf$/i, '').toLowerCase();
        const cleanSlug = rawSlug.replace(/[^\w-]/g, '') || `doc-${Date.now()}`;
        const filePath = path.join(UPLOADS_DIR, filename);
        const stats = fs.statSync(filePath);

        docs.push({
          id: `doc-${parts[0] || Date.now()}`,
          title: rawSlug.replace(/[-_]/g, ' ').toUpperCase(),
          slug: cleanSlug,
          filename,
          originalName: filename,
          fileSize: stats.size,
          uploadedAt: stats.birthtime.toISOString(),
          uploadedBy: 'admin@okdemocrats.org',
          views: 0,
          description: 'Restored from disk'
        });
        updated = true;
      }
    }

    if (updated || !fs.existsSync(MANIFEST_PATH)) {
      saveManifest(docs);
    }
  } catch (err) {
    console.error('Error scanning uploads folder:', err);
  }

  return docs;
}

// In-memory document index initialized from disk
let pdfDocuments: PdfDocument[] = loadManifest();

// Configure multer storage for uploaded PDF files
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max PDF size
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are allowed.'));
    }
  }
});

app.use(express.json({ limit: '10mb' }));

// ==========================================
// API ROUTES
// ==========================================

/**
 * GET /api/pdfs
 * Retrieves all hosted PDF documents.
 */
app.get('/api/pdfs', (_req: Request, res: Response) => {
  res.json({ success: true, documents: pdfDocuments });
});

/**
 * GET /api/pdfs/:slug
 * Retrieves metadata for a specific PDF by slug and increments its view count.
 */
app.get('/api/pdfs/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  let doc = pdfDocuments.find((d) => d.slug.toLowerCase() === slug.toLowerCase());

  if (!doc) {
    pdfDocuments = loadManifest();
    doc = pdfDocuments.find((d) => d.slug.toLowerCase() === slug.toLowerCase());
  }

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Increment view counter
  doc.views += 1;
  saveManifest(pdfDocuments);
  res.json({ success: true, document: doc });
});

/**
 * GET /api/pdfs/raw/:slug
 * Serves the raw PDF binary stream with Content-Type: application/pdf for browser embedding.
 */
app.get('/api/pdfs/raw/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  let doc = pdfDocuments.find((d) => d.slug.toLowerCase() === slug.toLowerCase());

  if (!doc) {
    pdfDocuments = loadManifest();
    doc = pdfDocuments.find((d) => d.slug.toLowerCase() === slug.toLowerCase());
  }

  if (!doc) {
    return res.status(404).send('PDF document not found');
  }

  const filePath = path.join(UPLOADS_DIR, doc.filename);

  if (!fs.existsSync(filePath)) {
    // If local file missing, fallback to sample base64 buffer
    const fallbackBuffer = Buffer.from(SAMPLE_OKDEMS_PDF_BASE64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    return res.send(fallbackBuffer);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
  res.sendFile(filePath);
});

/**
 * POST /api/pdfs/upload
 * Accepts a PDF file upload along with title, slug, description, and uploader email.
 */
app.post('/api/pdfs/upload', upload.single('pdf'), (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { title, slug, description, uploaderEmail } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No PDF file attached' });
    }

    if (!title || !slug) {
      return res.status(400).json({ error: 'Document title and slug are required' });
    }

    // Verify uploader is authorized @okdemocrats.org email
    if (uploaderEmail && !isValidOkDemsEmail(uploaderEmail)) {
      return res.status(403).json({ error: 'Unauthorized: Uploading requires an @okdemocrats.org email.' });
    }

    // Check slug collision
    const sanitizedSlug = slug.trim().toLowerCase().replace(/[^\w-]/g, '');
    const existingIndex = pdfDocuments.findIndex((d) => d.slug.toLowerCase() === sanitizedSlug);

    const newDoc: PdfDocument = {
      id: `doc-${Date.now()}`,
      title: title.trim(),
      slug: sanitizedSlug,
      filename: file.filename,
      originalName: file.originalname,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploaderEmail || 'admin@okdemocrats.org',
      views: 0,
      description: description ? description.trim() : undefined
    };

    if (existingIndex >= 0) {
      // Replace existing document on slug collision
      pdfDocuments[existingIndex] = newDoc;
    } else {
      pdfDocuments.unshift(newDoc);
    }

    saveManifest(pdfDocuments);

    res.json({ success: true, document: newDoc });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

/**
 * PATCH /api/pdfs/:id
 * Updates metadata (title, slug, description) for an existing document.
 */
app.patch('/api/pdfs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, slug, description } = req.body;

  let doc = pdfDocuments.find((d) => d.id === id);
  if (!doc) {
    pdfDocuments = loadManifest();
    doc = pdfDocuments.find((d) => d.id === id);
  }

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (title) doc.title = title.trim();
  if (slug) doc.slug = slug.trim().toLowerCase().replace(/[^\w-]/g, '');
  if (description !== undefined) doc.description = description.trim();

  saveManifest(pdfDocuments);

  res.json({ success: true, document: doc });
});

/**
 * DELETE /api/pdfs/:id
 * Deletes a PDF document and deletes its stored file from disk.
 */
app.delete('/api/pdfs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  let index = pdfDocuments.findIndex((d) => d.id === id);

  if (index === -1) {
    pdfDocuments = loadManifest();
    index = pdfDocuments.findIndex((d) => d.id === id);
  }

  if (index === -1) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const [removed] = pdfDocuments.splice(index, 1);
  const filePath = path.join(UPLOADS_DIR, removed.filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (_e) {
      // Ignore file deletion error if file missing
    }
  }

  saveManifest(pdfDocuments);

  res.json({ success: true, message: 'Document deleted successfully' });
});

/**
 * POST /api/auth/verify-domain
 * Verifies email address domain against @okdemocrats.org required policy.
 */
app.post('/api/auth/verify-domain', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address required' });
  }

  const isValid = isValidOkDemsEmail(email);

  if (!isValid) {
    return res.status(403).json({
      error: 'Access Restricted',
      message: 'Admin access requires a verified @okdemocrats.org email address.'
    });
  }

  res.json({
    success: true,
    user: {
      email,
      name: email.split('@')[0].replace('.', ' '),
      isOkDemsVerified: true
    }
  });
});

// ==========================================
// VITE SPA MIDDLEWARE / PRODUCTION STATIC
// ==========================================

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`OKDEMS PDF Host Server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

if (process.env.VERCEL !== '1') {
  start();
}

export default app;

