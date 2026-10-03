import React, { useMemo, useState } from 'react';
import type { DocumentAttachment } from '../../utils/documentUpload';
import DocumentViewer from './DocumentViewer';

type FileViewerTriggerProps = {
  /** Convex storage ID of the file */
  storageId: string;
  /** Stored content type (from the query), used to show photos vs PDFs correctly */
  contentType?: string | null;
  /** File name shown in the viewer, when known */
  name?: string;
  /** Viewer title */
  title: string;
  children: (open: () => void) => React.ReactNode;
};

/**
 * Opens one stored file (CC&Rs, covenant attachments) in the same viewer as multi-page
 * documents: iOS page sheet with the PDF inline, Android bottom sheet with the native PDF view,
 * desktop modal. Pages it can't draw (e.g. Word on Android) offer the in-app browser.
 */
export default function FileViewerTrigger({ storageId, contentType, name, title, children }: FileViewerTriggerProps) {
  const [open, setOpen] = useState(false);
  const pages = useMemo<DocumentAttachment[]>(
    () => [
      {
        storageId,
        kind: contentType?.startsWith('image/') ? 'image' : 'file',
        mimeType: contentType ?? undefined,
        name,
      },
    ],
    [storageId, contentType, name]
  );

  return (
    <>
      {children(() => setOpen(true))}
      <DocumentViewer visible={open} title={title} pages={pages} onClose={() => setOpen(false)} />
    </>
  );
}
