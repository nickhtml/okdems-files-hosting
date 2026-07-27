/**
 * @file src/types.ts
 * @description Global TypeScript definitions for the OKDEMS PDF Host application.
 * Defines data structures for hosted PDF documents, authentication state, and API responses.
 */

export interface PdfDocument {
  id: string;
  title: string;
  slug: string;
  filename: string;
  originalName: string;
  fileSize: number; // in bytes
  uploadedAt: string; // ISO String
  uploadedBy: string; // Email address of uploader
  views: number;
  description?: string;
  fileDataUri?: string; // Optional embedded data URL for initial sample storage
}

export interface UserSession {
  email: string;
  name: string;
  picture?: string;
  isOkDemsVerified: boolean;
  token?: string;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
}

export interface UploadResponse {
  success: boolean;
  document: PdfDocument;
}
