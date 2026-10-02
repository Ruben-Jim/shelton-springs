import { getUploadReadyImage } from './imageUpload';

/** Most photos a single document (e.g. a multi-page bank statement) can hold. */
export const MAX_DOCUMENT_PHOTOS = 10;

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

/** Optimize and upload photos in parallel; returned ids keep the same order as `uris`. */
export const uploadDocumentPhotos = (
  generateUploadUrl: () => Promise<string>,
  uris: string[]
): Promise<string[]> =>
  Promise.all(
    uris.map(async (uri) => {
      const { blob, mimeType } = await getUploadReadyImage(uri);
      return uploadBlobToStorage(generateUploadUrl, blob, mimeType);
    })
  );
