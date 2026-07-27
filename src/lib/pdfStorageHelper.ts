/**
 * @file src/lib/pdfStorageHelper.ts
 * @description Client-side IndexedDB & LocalStorage persistent binary storage for PDF files.
 * Provides instant Blob URL generation for uploaded PDFs without network dependency.
 */

const DB_NAME = 'OKDEMS_PDF_DB';
const STORE_NAME = 'pdf_files';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a PDF Base64 data string in IndexedDB by slug.
 */
export async function storePdfBinary(slug: string, base64Data: string): Promise<void> {
  const cleanSlug = slug.toLowerCase().trim();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(base64Data, cleanSlug);
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  } catch (_e) {
    // LocalStorage fallback if IndexedDB fails
    try {
      localStorage.setItem(`pdf_bin_${cleanSlug}`, base64Data);
    } catch (_lsErr) {
      // Quota exceeded or ignored
    }
  }
}

/**
 * Retrieves a PDF Base64 data string from IndexedDB or LocalStorage by slug.
 */
export async function getPdfBinary(slug: string): Promise<string | null> {
  const cleanSlug = slug.toLowerCase().trim();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(cleanSlug);
    const result = await new Promise<string | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (result) return result;
  } catch (_e) {
    // Fallback to LocalStorage
  }

  try {
    const lsVal = localStorage.getItem(`pdf_bin_${cleanSlug}`);
    if (lsVal) return lsVal;
  } catch (_e) {
    // Ignore
  }

  return null;
}

/**
 * Deletes a PDF Base64 entry by slug.
 */
export async function deletePdfBinary(slug: string): Promise<void> {
  const cleanSlug = slug.toLowerCase().trim();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(cleanSlug);
  } catch (_e) {
    // Fallback
  }
  try {
    localStorage.removeItem(`pdf_bin_${cleanSlug}`);
  } catch (_e) {
    // Ignore
  }
}

/**
 * Converts a Base64 data URI or raw base64 string to a Blob URL.
 */
export function base64ToBlobUrl(base64Data: string): string | null {
  try {
    const parts = base64Data.split(',');
    const rawBase64 = parts.length > 1 ? parts[1] : parts[0];
    const mimeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';

    const bstr = atob(rawBase64);
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
