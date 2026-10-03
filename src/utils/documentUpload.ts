import { getUploadReadyImage } from './imageUpload';

/** Most pages (photos and files combined) a single document can hold. */
export const MAX_DOCUMENT_ATTACHMENTS = 10;

/** Largest PDF/Word file accepted per page. */
export const MAX_DOCUMENT_FILE_MB = 10;

/** File types accepted by the "Add files" picker (PDF, Word, any image). */
export const DOCUMENT_PICKER_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/*',
];

export type AttachmentKind = 'image' | 'file';

/** A photo or file picked in the upload sheet but not uploaded yet. */
export type PendingAttachment = {
  id: string;
  uri: string;
  kind: AttachmentKind;
  name: string;
  mimeType?: string;
};

/** A stored page of a document, in display order. */
export type DocumentAttachment = {
  storageId: string;
  kind: AttachmentKind;
  name?: string;
  mimeType?: string;
};

let pendingCounter = 0;

/** Build a pending attachment, treating anything with an image mime type or extension as a photo. */
export const toPendingAttachment = (asset: {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}): PendingAttachment => {
  const name = asset.name || asset.fileName || asset.uri.split('/').pop() || 'File';
  const mimeType = asset.mimeType ?? undefined;
  const isImage =
    (mimeType?.startsWith('image/') ?? false) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
  pendingCounter += 1;
  return {
    id: `${Date.now()}-${pendingCounter}`,
    uri: asset.uri,
    kind: isImage ? 'image' : 'file',
    name,
    mimeType,
  };
};

/** Upload a blob to Convex storage and return its storage id. */
export const uploadBlobToStorage = async (
  generateUploadUrl: () => Promise<string>,
  blob: Blob,
  mimeType: string
): Promise<string> => {
  const uploadUrl = await generateUploadUrl();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!uploadResponse.ok) throw new Error('Upload failed');
  const { storageId } = await uploadResponse.json();
  return storageId;
};

/** Upload photos (optimized) and files in parallel; the result keeps the same order as `items`. */
export const uploadDocumentAttachments = (
  generateUploadUrl: () => Promise<string>,
  items: PendingAttachment[]
): Promise<DocumentAttachment[]> =>
  Promise.all(
    items.map(async (item) => {
      if (item.kind === 'image') {
        const { blob, mimeType } = await getUploadReadyImage(item.uri);
        const storageId = await uploadBlobToStorage(generateUploadUrl, blob, mimeType);
        return { storageId, kind: 'image' as const, name: item.name, mimeType };
      }
      const blob = await (await fetch(item.uri)).blob();
      if (blob.size / (1024 * 1024) > MAX_DOCUMENT_FILE_MB) {
        throw new Error(`"${item.name}" is too large. Maximum ${MAX_DOCUMENT_FILE_MB}MB per file.`);
      }
      const mimeType = blob.type || item.mimeType || 'application/pdf';
      const storageId = await uploadBlobToStorage(generateUploadUrl, blob, mimeType);
      return { storageId, kind: 'file' as const, name: item.name, mimeType };
    })
  );
