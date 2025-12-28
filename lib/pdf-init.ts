import * as pdfjsLib from 'pdfjs-dist';

export function initPDFWorker() {
    if (typeof window === 'undefined') return; // Server-side check

    // FORCE the worker to load from the local public file
    // This prevents the "Fake Worker" warning and performance collapse
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        // Option A: If you put the file in /public/pdf.worker.min.mjs
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        
        console.log('[PDF-Init] Worker source set to local file');
    }
}
