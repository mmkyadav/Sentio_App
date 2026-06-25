import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Download, RefreshCw } from 'lucide-react';

interface PDFSlideViewerProps {
  fileUrl: string;
  filename?: string;
}

// Dynamically load PDF.js from CDN to avoid bundling overhead
const loadPDFJS = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = (e) => reject(new Error('Failed to load PDF.js library'));
    document.body.appendChild(script);
  });
};

export default function PDFSlideViewer({ fileUrl, filename }: PDFSlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPdf(null);

    loadPDFJS()
      .then((pdfjsLib) => {
        return pdfjsLib.getDocument(fileUrl).promise;
      })
      .then((loadedPdf) => {
        if (!active) return;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setPageNum(1);
        setLoading(false);
      })
      .catch((err) => {
        console.error('PDF loading error:', err);
        if (active) {
          setError('Failed to load PDF document.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let renderTask: any = null;

    pdf.getPage(pageNum)
      .then((page: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Determine viewport and set canvas sizes
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        return renderTask.promise;
      })
      .catch((err: any) => {
        if (err && err.name !== 'RenderingCancelledException') {
          console.error('PDF page render error:', err);
        }
      });

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, pageNum, scale]);

  const handlePrevPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pageNum > 1) {
      setPageNum(pageNum - 1);
    }
  };

  const handleNextPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pageNum < numPages) {
      setPageNum(pageNum + 1);
    }
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.2, 0.6));
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error('Error entering fullscreen:', err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.error('Error exiting fullscreen:', err));
    }
  };

  // Keep state sync with native fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = fileUrl;
    link.target = '_blank';
    link.download = filename || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-slate-100 dark:bg-darkbg-pill/10 border border-fine-light dark:border-fine-dark rounded-2xl overflow-hidden select-none select-none max-w-full ${
        isFullscreen ? 'h-screen w-screen p-4 justify-center items-center bg-zinc-900 z-50' : 'aspect-[4/3] w-full'
      }`}
    >
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-white/95 dark:bg-darkbg-card/95 border-b border-fine-light dark:border-fine-dark px-4 flex items-center justify-between z-10 transition-colors">
        <span className="text-xs font-semibold text-ink-dark dark:text-ink-light truncate max-w-[50%]">
          {filename || 'document.pdf'}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            disabled={loading || !!error}
            className="p-1.5 rounded-lg hover:bg-cream-dark/50 dark:hover:bg-darkbg-pill/35 text-slate-muted disabled:opacity-50"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomIn}
            disabled={loading || !!error}
            className="p-1.5 rounded-lg hover:bg-cream-dark/50 dark:hover:bg-darkbg-pill/35 text-slate-muted disabled:opacity-50"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-fine-light dark:bg-fine-dark mx-1"></div>
          {/* Action buttons */}
          <button
            onClick={toggleFullscreen}
            disabled={loading || !!error}
            className="p-1.5 rounded-lg hover:bg-cream-dark/50 dark:hover:bg-darkbg-pill/35 text-slate-muted disabled:opacity-50"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || !!error}
            className="p-1.5 rounded-lg hover:bg-cream-dark/50 dark:hover:bg-darkbg-pill/35 text-slate-muted disabled:opacity-50"
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main PDF Rendering Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 pt-14 pb-14 w-full h-full relative">
        {loading && (
          <div className="flex flex-col items-center gap-2 text-slate-muted">
            <RefreshCw className="h-6 w-6 animate-spin text-accent-warm" />
            <span className="text-xs">Loading document pages...</span>
          </div>
        )}

        {error && (
          <div className="text-center text-xs text-red-500 font-medium px-4">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="shadow-lg max-h-full max-w-full overflow-hidden border border-fine-light/40 dark:border-fine-dark/40 bg-white">
            <canvas ref={canvasRef} className="max-h-full max-w-full block" />
          </div>
        )}
      </div>

      {/* Bottom Footer Controls */}
      {!loading && !error && numPages > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-white/95 dark:bg-darkbg-card/95 border-t border-fine-light dark:border-fine-dark flex items-center justify-between px-4 z-10 transition-colors">
          <button
            onClick={handlePrevPage}
            disabled={pageNum <= 1}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-cream-dark/30 dark:bg-darkbg-pill/25 hover:bg-cream-dark/60 dark:hover:bg-darkbg-pill/45 text-ink-dark dark:text-ink-light disabled:opacity-30 disabled:hover:bg-cream-dark/30 transition-all"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Prev</span>
          </button>

          <span className="text-xs text-slate-muted dark:text-slate-mutedDark font-medium">
            Page {pageNum} of {numPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={pageNum >= numPages}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-cream-dark/30 dark:bg-darkbg-pill/25 hover:bg-cream-dark/60 dark:hover:bg-darkbg-pill/45 text-ink-dark dark:text-ink-light disabled:opacity-30 disabled:hover:bg-cream-dark/30 transition-all"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
