/** Native: never rendered (the apps draw PDFs natively). The web build uses WebPdfView.web.tsx. */
export default function WebPdfView(_props: {
  url: string;
  onZoomChange?: (zoomed: boolean) => void;
  onError?: () => void;
}) {
  return null;
}
