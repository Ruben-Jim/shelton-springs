import { Platform } from 'react-native';
import type { DocumentAttachment } from '../../utils/documentUpload';
import { canUseNativePdf, canUseWebViewDocs } from '../ios/nativeModuleSupport';

export interface DocumentLike {
  title: string;
  fileStorageId: string;
  imageStorageIds?: string[];
  attachments?: DocumentAttachment[];
  /** Content type of fileStorageId, added by the documents queries (null if unknown). */
  fileContentType?: string | null;
}

/**
 * Ordered pages of a document. Multi-page documents use their attachments (or legacy photo
 * list); single-file documents become one page typed from the stored file's content type.
 */
export const getDocumentPages = (document: DocumentLike): DocumentAttachment[] => {
  if (document.attachments && document.attachments.length > 1) return document.attachments;
  if (document.imageStorageIds && document.imageStorageIds.length > 1) {
    return document.imageStorageIds.map((storageId) => ({ storageId, kind: 'image' }));
  }
  const mimeType = document.fileContentType ?? undefined;
  return [
    {
      storageId: document.fileStorageId,
      kind: mimeType?.startsWith('image/') ? 'image' : 'file',
      mimeType,
    },
  ];
};

export type PageFileType = 'image' | 'pdf' | 'word' | 'other';

export const getPageFileType = (page: DocumentAttachment): PageFileType => {
  if (page.kind === 'image') return 'image';
  const mime = page.mimeType?.toLowerCase() ?? '';
  const name = page.name?.toLowerCase() ?? '';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'word';
  // Single-file documents uploaded before content types were tracked are almost always PDFs
  if (!mime && !name) return 'pdf';
  return 'other';
};

/**
 * True when the viewer can show this page inline. Photos: everywhere. PDFs: web, iOS via
 * WKWebView (which also renders Word), Android via react-native-pdf. Anything else (Word on
 * Android/web) opens in the in-app browser / a new tab on tap.
 */
export const canPreviewInline = (page: DocumentAttachment): boolean => {
  const type = getPageFileType(page);
  if (type === 'image') return true;
  if (Platform.OS === 'web') return type === 'pdf';
  if (Platform.OS === 'ios') return canUseWebViewDocs && (type === 'pdf' || type === 'word');
  if (Platform.OS === 'android') return canUseNativePdf && type === 'pdf';
  return false;
};

export const PAGE_FILE_LABELS: Record<PageFileType, string> = {
  image: 'Photo',
  pdf: 'PDF document',
  word: 'Word document',
  other: 'File',
};
