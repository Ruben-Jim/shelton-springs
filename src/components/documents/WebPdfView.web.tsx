import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { loadPdfLibs, openPdf, type PdfViewer } from './webPdf';

/** pdf.js viewer's own pinch redraw delay: CSS-scaled while pinching, sharp shortly after. */
const ZOOM_REDRAW_DELAY_MS = 400;
const MAX_ZOOM = 4; // times fit-to-width
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 30;
/** Phones cap canvas memory; pdf.js uses the same limit on iOS/Android. */
const MAX_CANVAS_PIXELS = 5_242_880;

type WebPdfViewProps = {
  url: string;
  /** Lets the pager stop swiping while the PDF is zoomed in (pans move the PDF instead) */
  onZoomChange?: (zoomed: boolean) => void;
  /** pdf.js couldn't load or open the file */
  onError?: () => void;
};

/**
 * Phone web PDF (see webPdf.ts): every page stacked top to bottom in pdf.js's page viewer,
 * fit to width, scrolling vertically. Pinch or double-tap zooms only the PDF, like the PDF view
 * in the native apps.
 */
export default function WebPdfView({ url, onZoomChange, onError }: WebPdfViewProps) {
  const hostRef = useRef<View>(null);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onZoomChange, onError });
  callbacks.current = { onZoomChange, onError };

  useEffect(() => {
    // react-native-web host views are DOM elements
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];

    (async () => {
      try {
        const { pdfjs, viewer: viewerLib } = await loadPdfLibs();
        if (disposed) return;

        // pdf.js wants an absolutely positioned scroll container around a .pdfViewer div
        const container = document.createElement('div');
        container.style.cssText =
          'position:absolute;inset:0;overflow:auto;background:#f3f4f6;' +
          // Two-finger gestures are ours (zoom the PDF, not the web page); one finger scrolls
          'touch-action:pan-x pan-y;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;';
        const viewerEl = document.createElement('div');
        viewerEl.className = 'pdfViewer';
        container.appendChild(viewerEl);
        host.appendChild(container);
        cleanups.push(() => container.remove());

        const eventBus = new viewerLib.EventBus();
        const viewer: PdfViewer = new viewerLib.PDFViewer({
          container,
          viewer: viewerEl,
          eventBus,
          removePageBorders: true,
          textLayerMode: 0,
          annotationMode: pdfjs.AnnotationMode.DISABLE,
          maxCanvasPixels: MAX_CANVAS_PIXELS,
        });
        cleanups.push(() => {
          viewer.setDocument(null);
          viewer.cleanup();
        });

        let fitScale = 1;
        let zoomed = false;
        eventBus.on('pagesinit', () => {
          viewer.currentScaleValue = 'page-width';
          fitScale = viewer.currentScale;
          setReady(true);
        });
        eventBus.on('scalechanging', ({ scale }) => {
          // pdf.js rounds scales to 0.01, so allow a little slack around fit
          const next = scale > fitScale + 0.02;
          if (next === zoomed) return;
          zoomed = next;
          callbacks.current.onZoomChange?.(next);
        });

        const zoomTo = (target: number, origin: [number, number]) => {
          const clamped = Math.min(fitScale * MAX_ZOOM, Math.max(fitScale, target));
          if (Math.abs(clamped - viewer.currentScale) < 0.01) return;
          viewer.updateScale({
            scaleFactor: clamped / viewer.currentScale,
            origin,
            drawingDelay: ZOOM_REDRAW_DELAY_MS,
          });
        };

        // Pinch: scale from the distance between two fingers at the start of the pinch
        let pinch: { distance: number; scale: number } | null = null;
        let lastTap: { time: number; x: number; y: number } | null = null;
        const fingerDistance = (touches: TouchList) =>
          Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) || 1;

        const onTouchStart = (event: TouchEvent) => {
          if (event.touches.length !== 2) return;
          event.preventDefault();
          pinch = { distance: fingerDistance(event.touches), scale: viewer.currentScale };
          lastTap = null;
        };
        const onTouchMove = (event: TouchEvent) => {
          if (!pinch || event.touches.length !== 2) return;
          event.preventDefault();
          const [a, b] = [event.touches[0], event.touches[1]];
          zoomTo(pinch.scale * (fingerDistance(event.touches) / pinch.distance), [
            (a.pageX + b.pageX) / 2,
            (a.pageY + b.pageY) / 2,
          ]);
        };
        const onTouchEnd = (event: TouchEvent) => {
          if (pinch) {
            if (event.touches.length < 2) pinch = null;
            return;
          }
          // Double-tap: zoom in at the tap, or back to fit when zoomed
          if (event.touches.length > 0 || event.changedTouches.length !== 1) return;
          const touch = event.changedTouches[0];
          const now = Date.now();
          const isDoubleTap =
            lastTap &&
            now - lastTap.time < DOUBLE_TAP_MS &&
            Math.hypot(touch.pageX - lastTap.x, touch.pageY - lastTap.y) < DOUBLE_TAP_SLOP;
          if (!isDoubleTap) {
            lastTap = { time: now, x: touch.pageX, y: touch.pageY };
            return;
          }
          event.preventDefault();
          lastTap = null;
          if (zoomed) viewer.currentScaleValue = 'page-width';
          else zoomTo(fitScale * DOUBLE_TAP_ZOOM, [touch.pageX, touch.pageY]);
        };
        // Safari's own pinch gesture would zoom the whole page
        const preventGesture = (event: Event) => event.preventDefault();

        const listeners: [string, EventListener][] = [
          ['touchstart', onTouchStart as EventListener],
          ['touchmove', onTouchMove as EventListener],
          ['touchend', onTouchEnd as EventListener],
          ['touchcancel', (() => (pinch = null)) as EventListener],
          ['gesturestart', preventGesture],
          ['gesturechange', preventGesture],
        ];
        listeners.forEach(([type, listener]) => container.addEventListener(type, listener, { passive: false }));
        cleanups.push(() => listeners.forEach(([type, listener]) => container.removeEventListener(type, listener)));

        const task = openPdf(pdfjs, url);
        cleanups.push(() => {
          task.destroy();
        });
        const pdfDocument = await task.promise;
        if (disposed) return;
        viewer.setDocument(pdfDocument);
      } catch {
        if (!disposed) callbacks.current.onError?.();
      }
    })();

    return () => {
      disposed = true;
      // Last in, first out: stop listening and close the file before removing the DOM
      cleanups.reverse().forEach((cleanup) => cleanup());
      callbacks.current.onZoomChange?.(false);
    };
  }, [url]);

  return (
    <View ref={hostRef} style={styles.host}>
      {!ready && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#2563eb" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
