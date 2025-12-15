
'use client';
import { useState, useEffect, useRef } from 'react';
import { DataGrid } from './DataGrid';
import { Loader2, Zap } from 'lucide-react';
import { TrendChart } from './TrendChart';
import * as pdfjsLib from 'pdfjs-dist';

// GummyButton substitute if not available or import from correct path
// Assuming existing GummyButton is in components/ui/GummyButton
// If not found, I will use a simple button and let the user know.
// I will check file list first or just assume standard button style for now to avoid errors.
// Wait, I saw components/ui folder in file list.
import { GummyButton } from '../ui/GummyButton';

interface ResearchToolsProps {
  pdfBuffer: ArrayBuffer | null;
  onJumpToPage: (page: number) => void;
}

export function ResearchTools({ pdfBuffer, onJumpToPage }: ResearchToolsProps) {
  const [activeTab, setActiveTab] = useState<'glossary' | 'miner'>('glossary');
  const [indexTerms, setIndexTerms] = useState<{term: string, pages: number[]}[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Miner State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metrics, setMetrics] = useState<any[]>([]);
  const [isMining, setIsMining] = useState(false);
  const [minerMetricName, setMinerMetricName] = useState('Net Profit');
  const [minerKeywords, setMinerKeywords] = useState('profit, net, income');
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Worker
    // Note: The path to worker needs to be correct.
    // If we put worker in public folder (as compiled js), we reference it by URL.
    // If we use Next.js webpack worker loader, we import it.
    // The previous setup used `new Worker(new URL('../../workers/miner.worker.ts', import.meta.url))` which works with Next.js App Router if configured.
    // However, the instructions say "Update workers/miner.worker.ts".
    // Let's try the URL method first.
    workerRef.current = new Worker(new URL('../../workers/miner.worker.ts', import.meta.url));

    workerRef.current.onmessage = (e) => {
      const { type, data, metric } = e.data;
      if (type === 'INDEX_RESULT') {
        setIndexTerms(data);
        setIsScanning(false);
      }
      if (type === 'METRIC_RESULT') {
        setMetrics(prev => [...prev, { metric, ...data }]);
        setIsMining(false);
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  const handleScanIndex = () => {
    if (!pdfBuffer) return;
    setIsScanning(true);
    // Convert ArrayBuffer to something transferrable if needed, or just pass it.
    // ArrayBuffer is transferrable.
    workerRef.current?.postMessage({ type: 'SCAN_INDEX', payload: { pdfBuffer } });
  };

  const handleRunMiner = async () => {
    if (!pdfBuffer) return;
    setIsMining(true);

    try {
        // 1. Read the PDF text on the client (or in worker)
        // Ensure pdfjs global worker source is set if needed, though usually dealt with in utility/PDFViewer
        if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
             pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        }

        const doc = await pdfjsLib.getDocument(pdfBuffer).promise;
        const chunks: string[] = [];

        // Grab text from first 20 pages (or all) to create chunks
        for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
           const page = await doc.getPage(i);
           const content = await page.getTextContent();
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const text = content.items.map((item: any) => item.str).join(' ');
           chunks.push(text);
        }

        // 2. Send REAL chunks to worker
        workerRef.current?.postMessage({
          type: 'MINE_METRIC',
          payload: {
            chunks: chunks,
            metric: minerMetricName,
            keywords: minerKeywords.split(',').map(k => k.trim())
          }
        });
    } catch (e) {
        console.error("Error reading PDF text:", e);
        setIsMining(false);
    }
  };

  // Filter Glossary
  const filteredTerms = indexTerms.filter(t => t.term.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-black/40 text-white p-4 space-y-4 rounded-xl">

      {/* Tab Switcher */}
      <div className="flex space-x-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('glossary')}
          className={`px-3 py-1 text-sm rounded-md transition ${activeTab === 'glossary' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Glossary Hopper
        </button>
        <button
          onClick={() => setActiveTab('miner')}
          className={`px-3 py-1 text-sm rounded-md transition ${activeTab === 'miner' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Data Miner
        </button>
      </div>

      {/* GLOSSARY VIEW */}
      {activeTab === 'glossary' && (
        <div className="space-y-4 h-full flex flex-col">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search index..."
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {indexTerms.length === 0 && (
              <GummyButton onClick={handleScanIndex} disabled={!pdfBuffer || isScanning}>
                {isScanning ? <Loader2 className="animate-spin h-4 w-4" /> : "Scan"}
              </GummyButton>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
             {filteredTerms.map((item, idx) => (
               <div key={idx} className="flex justify-between items-center p-2 hover:bg-white/5 rounded group">
                 <span className="text-sm text-gray-300">{item.term}</span>
                 <div className="flex gap-1">
                   {item.pages.map(page => (
                     <button
                       key={page}
                       onClick={() => onJumpToPage(page)}
                       className="text-xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded hover:bg-indigo-500 hover:text-white transition"
                     >
                       {page}
                     </button>
                   ))}
                 </div>
               </div>
             ))}
             {indexTerms.length === 0 && !isScanning && (
               <div className="text-center text-gray-500 mt-10 text-sm">
                 Scan document to build index.
               </div>
             )}
          </div>
        </div>
      )}

      {/* MINER VIEW */}
      {activeTab === 'miner' && (
        <div className="space-y-4 h-full flex flex-col">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
             <h4 className="text-sm font-medium text-indigo-300 mb-2 flex items-center gap-2">
               <Zap className="h-4 w-4" /> Auto-Extraction
             </h4>
             <p className="text-xs text-gray-400 mb-3">
               Extract unstructured data securely on your device.
             </p>
             <div className="space-y-2 mb-3">
                 <input
                     type="text"
                     className="w-full bg-indigo-900/30 border border-indigo-500/30 rounded px-2 py-1 text-xs text-white"
                     placeholder="Metric Name (e.g. Total Revenue)"
                     value={minerMetricName}
                     onChange={e => setMinerMetricName(e.target.value)}
                 />
                 <input
                     type="text"
                     className="w-full bg-indigo-900/30 border border-indigo-500/30 rounded px-2 py-1 text-xs text-white"
                     placeholder="Keywords (comma separated)"
                     value={minerKeywords}
                     onChange={e => setMinerKeywords(e.target.value)}
                 />
             </div>
             <GummyButton onClick={handleRunMiner} disabled={!pdfBuffer || isMining} className="w-full">
                {isMining ? "Mining..." : "Run Extraction"}
             </GummyButton>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            <DataGrid data={metrics} />
            {metrics.length > 0 && <TrendChart data={metrics} />}
          </div>
        </div>
      )}
    </div>
  );
}
