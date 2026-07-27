/**
 * @file src/lib/firestoreStore.ts
 * @description Firestore store helper for syncing PDF metadata and base64 content
 * directly with Firebase Firestore for high availability across Vercel deployments.
 */

import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { PdfDocument } from '../types';

export interface FirestorePdfDoc extends PdfDocument {
  pdfBase64?: string;
}

const COLLECTION_NAME = 'pdfs';

/**
 * Retrieves all PDF documents from Firestore.
 */
export async function getFirestorePdfs(): Promise<PdfDocument[]> {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    const results: PdfDocument[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as FirestorePdfDoc;
      const { pdfBase64, ...meta } = data;
      results.push(meta);
    });
    return results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (err) {
    console.warn('Firestore fetch error:', err);
    return [];
  }
}

/**
 * Retrieves a single PDF document metadata and base64 stream by slug.
 */
export async function getFirestorePdfBySlug(slug: string): Promise<FirestorePdfDoc | null> {
  try {
    const cleanSlug = slug.toLowerCase().trim();
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    let foundDoc: FirestorePdfDoc | null = null;
    let foundDocId = '';

    snapshot.forEach((d) => {
      const data = d.data() as FirestorePdfDoc;
      if (data.slug.toLowerCase() === cleanSlug) {
        foundDoc = data;
        foundDocId = d.id;
      }
    });

    if (foundDoc && foundDocId) {
      // Increment views count asynchronously
      try {
        const docRef = doc(db, COLLECTION_NAME, foundDocId);
        await updateDoc(docRef, { views: increment(1) });
      } catch (_e) {
        // Ignore view count update error
      }
    }

    return foundDoc;
  } catch (err) {
    console.warn('Firestore fetch by slug error:', err);
    return null;
  }
}

/**
 * Saves a PDF document metadata and base64 string to Firestore.
 */
export async function saveFirestorePdf(pdfDoc: PdfDocument, base64Data?: string): Promise<boolean> {
  try {
    const docRef = doc(db, COLLECTION_NAME, pdfDoc.id);
    const payload: FirestorePdfDoc = { ...pdfDoc };
    
    // Only embed base64 directly in Firestore doc if under 850KB to respect 1MB doc size limit
    if (base64Data && base64Data.length < 850000) {
      payload.pdfBase64 = base64Data;
    }
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    // If it failed with base64, try saving metadata only
    if (base64Data) {
      try {
        const docRef = doc(db, COLLECTION_NAME, pdfDoc.id);
        const { pdfBase64, ...metaOnly } = { ...pdfDoc } as FirestorePdfDoc;
        await setDoc(docRef, metaOnly, { merge: true });
        return true;
      } catch (_subErr) {
        // Fallthrough
      }
    }
    handleFirestoreError(err, OperationType.WRITE, `pdfs/${pdfDoc.id}`);
    return false;
  }
}

/**
 * Deletes a PDF document from Firestore.
 */
export async function deleteFirestorePdf(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `pdfs/${id}`);
    return false;
  }
}
