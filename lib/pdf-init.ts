import * as pdfjsLib from 'pdfjs-dist';

export function initPDFWorker() {
    if (typeof window === 'undefined') return;

    // Standard path that matches the 'postinstall' script above
    const workerSrc = '/pdf.worker.min.mjs';

    if (pdfjsLib.GlobalWorkerOptions.workerSrc !== workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        console.log('[PDF-Init] Forced worker source to:', workerSrc);
    }
}
