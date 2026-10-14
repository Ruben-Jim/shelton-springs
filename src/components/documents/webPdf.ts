/**
 * pdf.js for the document viewer on phone web. Phone browsers can't draw a PDF inside a page
 * (iOS Safari shows a cropped first page, Android Chrome nothing), so pdf.js's page viewer
 * shows it instead: pages stacked top to bottom, drawn as you scroll, pinch to zoom.
 *
 * pdf.js is self-hosted in public/pdfjs/<version> (Apache-2.0, legacy build for older iPhones).
 * Its ES modules can't go through Metro, so the browser imports them at runtime, and only when
 * a PDF is opened. Imported only by WebPdfView.web.tsx.
 */

const PDFJS_BASE = '/pdfjs/5.7.284/';

// The slice of the pdf.js API the viewer uses
export type PdfDocument = { numPages: number };
export type PdfLoadingTask = { promise: Promise<PdfDocument>; destroy(): Promise<void> };
type PdfjsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  AnnotationMode: { DISABLE: number };
  getDocument(source: { url: string; wasmUrl: string; isEvalSupported: boolean }): PdfLoadingTask;
};
export type PdfEventBus = {
  on(event: 'pagesinit', listener: () => void): void;
  on(event: 'scalechanging', listener: (event: { scale: number }) => void): void;
};
export type PdfViewer = {
  currentScale: number;
  currentScaleValue: string;
  setDocument(document: PdfDocument | null): void;
  updateScale(options: { scaleFactor: number; origin?: [number, number]; drawingDelay?: number }): void;
  cleanup(): void;
};
type PdfViewerLib = {
  EventBus: new () => PdfEventBus;
  PDFViewer: new (options: {
    container: HTMLDivElement;
    viewer: HTMLDivElement;
    eventBus: PdfEventBus;
    removePageBorders: boolean;
    textLayerMode: number;
    annotationMode: number;
    maxCanvasPixels: number;
  }) => PdfViewer;
};

export type PdfLibs = { pdfjs: PdfjsLib; viewer: PdfViewerLib };

let libsPromise: Promise<PdfLibs> | null = null;

// A native import() that Metro leaves alone (it would try to bundle a literal import)
const importModule = new Function('url', 'return import(url)') as <T>(url: string) => Promise<T>;

function loadStylesheet(href: string) {
  return new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Could not load ${href}`));
    document.head.appendChild(link);
  });
}

/** Loads pdf.js and its page viewer once; later calls reuse them. */
export function loadPdfLibs(): Promise<PdfLibs> {
  if (!libsPromise) {
    libsPromise = (async () => {
      const [pdfjs] = await Promise.all([
        importModule<PdfjsLib>(`${PDFJS_BASE}pdf.min.mjs`),
        loadStylesheet(`${PDFJS_BASE}pdf_viewer.css`),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}pdf.worker.min.mjs`;
      // The viewer module reads pdf.js from this global when it loads
      (globalThis as { pdfjsLib?: PdfjsLib }).pdfjsLib = pdfjs;
      const viewer = await importModule<PdfViewerLib>(`${PDFJS_BASE}pdf_viewer.mjs`);
      return { pdfjs, viewer };
    })().catch((error) => {
      libsPromise = null; // let the next open retry
      throw error;
    });
  }
  return libsPromise;
}

export function openPdf(pdfjs: PdfjsLib, url: string): PdfLoadingTask {
  return pdfjs.getDocument({ url, wasmUrl: `${PDFJS_BASE}wasm/`, isEvalSupported: false });
}
