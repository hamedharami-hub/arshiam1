import { ExternalLink } from "lucide-react";

/**
 * Lightweight native PDF preview (0 KB bundle overhead vs 2 MB pdfjs-dist).
 * Uses <object> + <iframe> fallback and direct open/download link for mobile WebViews.
 */
export function PdfPreview({ url, maxPages: _maxPages = 15, isEn }: { url: string; maxPages?: number; isEn: boolean }) {
  return (
    <div className="space-y-2 max-h-[72vh] overflow-y-auto" data-testid="attachment-preview-pdf">
      <object
        data={url}
        type="application/pdf"
        className="w-full h-[64vh] rounded-xl border border-border bg-background"
        aria-label={isEn ? "PDF document preview" : "پیش‌نمایش فایل PDF"}
      >
        <iframe
          src={url}
          title={isEn ? "PDF document preview" : "پیش‌نمایش فایل PDF"}
          className="w-full h-[64vh] rounded-xl border border-border bg-background"
        />
      </object>
      <div className="flex items-center justify-center py-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {isEn ? "Open or download PDF in full viewer" : "باز کردن یا دانلود فایل PDF در نمایشگر کامل"}
        </a>
      </div>
    </div>
  );
}
