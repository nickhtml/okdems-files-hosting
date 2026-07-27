/**
 * @file src/lib/pdfStore.ts
 * @description Helper store providing initial sample PDF documents and utility functions
 * for formatting file sizes, generating clean URL slugs, and handling PDF preview operations.
 */

import { PdfDocument } from '../types';

/**
 * Minimal valid single-page PDF encoded in Base64 for initial sample document display.
 * Displays "OKDEMS Digital Team - Official Hosted Document".
 */
export const SAMPLE_OKDEMS_PDF_BASE64 = `JVBERi0xLjcKCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagoyIDAgb2JqCjw8IC9UeXBlIC9QYWdlcyAvQ291bnQgMSAvS2lkcyBbIDMgMCBSIF0gPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9SZXNvdXJjZXMgNCAwIFIgL0NvbnRlbnRzIDUgMCBSID4+CmVuZG9iago0IDAgb2JqCjw8IC9Gb250IDw8IC9GMCA2IDAgUiA+PiA+PgplbmRvYmoKNSAwIG9iago8PCAvTGVuZ3RoIDE0MyA+PgpzdHJlYW0KQlQKL0YwIDI0IFRmCjcyIDcyMCBUZApSMC4wNSBHMC4yMyBCMC42MTAgcmcKKE9LREVNUyBEaWdpdGFsIFRlYW0pIFRqClRMCi9GMCAxNiBUZgoxMCAtNDAgVGQKMCBHMCBHMCByZwooT2ZmaWNpYWwgSG9zdGVkIERvY3VtZW50IC0gaG9zdC5va2RlbXsub3JnKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp0cmFpbGVyCjw8IC9Sb290IDEgMCBSID4+CiUlRU9G`;

/**
 * Initial sample PDF documents available in the system (empty by default).
 */
export const INITIAL_PDF_DOCUMENTS: PdfDocument[] = [];

/**
 * Converts a raw string title into a sanitized, URL-safe slug.
 * @param text The input title or string
 * @returns A clean hyphen-separated slug string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Formats a file size in bytes into a human-readable string (KB/MB).
 * @param bytes Number of bytes
 * @returns Formatted size string e.g. "2.4 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Validates whether an email belongs to the required @okdemocrats.org domain.
 * @param email Email address string to test
 * @returns boolean true if valid okdemocrats.org domain
 */
export function isValidOkDemsEmail(email: string): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith('@okdemocrats.org');
}

const LOCAL_STORAGE_KEY = 'okdems_pdf_documents_v2';

/**
 * Retrieves local cached PDF document metadata from localStorage.
 */
export function getLocalStoragePdfs(): PdfDocument[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

/**
 * Saves or updates a PDF document in localStorage.
 */
export function saveLocalStoragePdf(pdfDoc: PdfDocument): void {
  try {
    const existing = getLocalStoragePdfs();
    const filtered = existing.filter((d) => d.id !== pdfDoc.id && d.slug.toLowerCase() !== pdfDoc.slug.toLowerCase());
    const updated = [pdfDoc, ...filtered];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (_e) {
    // Ignore localStorage quota errors
  }
}

/**
 * Removes a PDF document from localStorage.
 */
export function deleteLocalStoragePdf(id: string): void {
  try {
    const existing = getLocalStoragePdfs();
    const updated = existing.filter((d) => d.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (_e) {
    // Ignore
  }
}
