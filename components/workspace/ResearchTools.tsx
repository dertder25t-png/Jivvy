
'use client';
import { useState, useCallback } from 'react';
import { DataGrid } from './DataGrid';
import { Loader2, Zap, AlertCircle, Search, MessageSquare, Send, BookOpen, ExternalLink, Cpu } from 'lucide-react';
import { TrendChart } from './TrendChart';
import { GummyButton } from '../ui/GummyButton';
import { scanForIndex, extractAllText, extractSpecificPages } from '@/utils/pdf-extraction';

interface ResearchToolsProps {
  pdfBuffer: ArrayBuffer | null;
  onJumpToPage: (page: number) => void;
}

interface QAResult {
  question: string;
  answer: string;
  sourcePages: number[];
  context: string;
}

export function ResearchTools({ pdfBuffer, onJumpToPage }: ResearchToolsProps) {
  const [activeTab, setActiveTab] = useState<'qa' | 'glossary' | 'miner'>('qa');
  const [indexTerms, setIndexTerms] = useState<{ term: string, pages: number[] }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Q&A State
  const [question, setQuestion] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [qaResults, setQaResults] = useState<QAResult[]>([]);
  const [qaError, setQaError] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<string>('');

  // Miner State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metrics, setMetrics] = useState<any[]>([]);
  const [isMining, setIsMining] = useState(false);
  const [minerMetricName, setMinerMetricName] = useState('Net Profit');
  const [minerKeywords, setMinerKeywords] = useState('profit, net, income');
  const [minerError, setMinerError] = useState<string | null>(null);

  // Scan for index terms
  const handleScanIndex = useCallback(async () => {
    if (!pdfBuffer) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const startTime = performance.now();
      const terms = await scanForIndex(pdfBuffer);
      const duration = Math.round(performance.now() - startTime);
      console.log(`[ResearchTools] Scan completed in ${duration}ms, found ${terms.length} terms`);
      setIndexTerms(terms);
    } catch (error) {
      console.error('[ResearchTools] Scan error:', error);
      setScanError(error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  }, [pdfBuffer]);

  // Ask a question - finds relevant pages and uses LOCAL LLM
  const handleAskQuestion = useCallback(async () => {
    if (!pdfBuffer || !question.trim()) return;

    setIsAnswering(true);
    setQaError(null);
    setLlmStatus('Finding relevant pages...');

    try {
      // 1. If no index scanned yet, do it now
      let currentIndex = indexTerms;
      if (currentIndex.length === 0) {
        setLlmStatus('Scanning document index...');
        currentIndex = await scanForIndex(pdfBuffer);
        setIndexTerms(currentIndex);
      }

      // 2. Find relevant pages based on question keywords
      const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matchedPages = new Set<number>();

      for (const term of currentIndex) {
        const termLower = term.term.toLowerCase();
        if (questionWords.some(word => termLower.includes(word) || word.includes(termLower.split(' ')[0]))) {
          term.pages.forEach(p => matchedPages.add(p));
        }
      }

      // If no matches from index, try pages 1-10 as fallback
      if (matchedPages.size === 0) {
        for (let i = 1; i <= 10; i++) matchedPages.add(i);
      }

      const pagesToExtract = Array.from(matchedPages).slice(0, 10); // Limit to 10 pages for local LLM
      setLlmStatus(`Extracting ${pagesToExtract.length} pages...`);

      // 3. Extract text from those pages
      const pageData = await extractSpecificPages(pdfBuffer, pagesToExtract);
      const context = pageData.map(p => `[Page ${p.page}] ${p.content}`).join('\n\n');

      if (!context.trim()) {
        setQaError('Could not extract text from relevant pages');
        setIsAnswering(false);
        return;
      }

      // 4. Use LOCAL LLM for answering (Transformers.js)
      const { answerQuestionLocal } = await import('@/utils/local-llm');
      const answer = await answerQuestionLocal(
        question,
        context.slice(0, 3000), // Smaller context for local model
        (progress) => setLlmStatus(progress.status)
      );

      setQaResults(prev => [{
        question,
        answer: answer,
        sourcePages: pagesToExtract,
        context: context.slice(0, 500) + '...'
      }, ...prev]);

      setQuestion('');
      setLlmStatus('');

    } catch (error) {
      console.error('[Q&A] Error:', error);
      setQaError(error instanceof Error ? error.message : 'Failed to get answer');
      setLlmStatus('');
    } finally {
      setIsAnswering(false);
    }
  }, [pdfBuffer, question, indexTerms]);

  // Mine metrics from PDF
  const handleRunMiner = useCallback(async () => {
    if (!pdfBuffer) return;

    setIsMining(true);
    setMinerError(null);

    try {
      const text = await extractAllText(pdfBuffer);

      if (!text || text.length === 0) {
        setMinerError('No text could be extracted from the PDF');
        setIsMining(false);
        return;
      }

      const keywords = minerKeywords.split(',').map(k => k.trim().toLowerCase());
      const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 10);

      const relevantSentences = sentences.filter(sentence =>
        keywords.some(kw => sentence.toLowerCase().includes(kw))
      );

      if (relevantSentences.length === 0) {
        setMetrics(prev => [...prev, {
          metric: minerMetricName,
          value: 'Keywords not found',
          confidence: 0
        }]);
      } else {
        const numberPattern = /[\$£€]?\s*[\d,]+\.?\d*/g;
        const numbers = relevantSentences.join(' ').match(numberPattern) || [];
        const meaningfulNumbers = numbers.filter(n => {
          const num = parseFloat(n.replace(/[,$£€\s]/g, ''));
          return !isNaN(num) && num > 10;
        });

        setMetrics(prev => [...prev, {
          metric: minerMetricName,
          value: meaningfulNumbers[0] || relevantSentences[0].substring(0, 50) + '...',
          confidence: meaningfulNumbers.length > 0 ? 0.75 : 0.5,
          pageContext: relevantSentences[0].substring(0, 100)
        }]);
      }
    } catch (error) {
      console.error('[ResearchTools] Miner error:', error);
      setMinerError(error instanceof Error ? error.message : 'Extraction failed');
    } finally {
      setIsMining(false);
    }
  }, [pdfBuffer, minerMetricName, minerKeywords]);

  const filteredTerms = indexTerms.filter(t => t.term.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-black/40 text-white p-4 space-y-4 rounded-xl">

      {/* Tab Switcher */}
      <div className="flex space-x-1 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('qa')}
          className={`px-3 py-1.5 text-sm rounded-md transition flex items-center gap-1.5 ${activeTab === 'qa' ? 'bg-lime-500 text-black font-medium' : 'text-gray-400 hover:text-white'}`}
        >
          <MessageSquare size={14} /> Ask
        </button>
        <button
          onClick={() => setActiveTab('glossary')}
          className={`px-3 py-1.5 text-sm rounded-md transition flex items-center gap-1.5 ${activeTab === 'glossary' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <BookOpen size={14} /> Index
        </button>
        <button
          onClick={() => setActiveTab('miner')}
          className={`px-3 py-1.5 text-sm rounded-md transition flex items-center gap-1.5 ${activeTab === 'miner' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Zap size={14} /> Miner
        </button>
      </div>

      {!pdfBuffer && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
          <AlertCircle size={16} />
          <span>Upload a PDF to use these tools</span>
        </div>
      )}

      {/* Q&A VIEW */}
      {activeTab === 'qa' && (
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Question Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask a question about the PDF..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                disabled={!pdfBuffer || isAnswering}
              />
              <GummyButton
                onClick={handleAskQuestion}
                disabled={!pdfBuffer || isAnswering || !question.trim()}
                className="px-4"
              >
                {isAnswering ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </GummyButton>
            </div>

            {qaError && (
              <p className="text-xs text-red-400">{qaError}</p>
            )}

            {indexTerms.length === 0 && pdfBuffer && (
              <p className="text-xs text-zinc-500">
                Tip: The system will scan for an index first to find relevant pages.
              </p>
            )}
          </div>

          {/* Answers */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {isAnswering && (
              <div className="flex items-center gap-3 text-zinc-400 py-4 px-3 bg-lime-500/5 border border-lime-500/20 rounded-lg">
                <Cpu className="animate-pulse text-lime-400" size={18} />
                <div className="flex-1">
                  <span className="text-sm text-lime-400">Local AI Processing</span>
                  <p className="text-xs text-zinc-500 mt-0.5">{llmStatus || 'Initializing...'}</p>
                </div>
                <Loader2 className="animate-spin text-lime-400" size={16} />
              </div>
            )}

            {qaResults.map((result, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-sm text-zinc-400 font-medium">{result.question}</p>
                <p className="text-sm text-white leading-relaxed">{result.answer}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-zinc-500">Sources:</span>
                  {result.sourcePages.slice(0, 8).map(page => (
                    <button
                      key={page}
                      onClick={() => onJumpToPage(page)}
                      className="text-xs bg-lime-500/20 text-lime-400 px-2 py-0.5 rounded hover:bg-lime-500 hover:text-black transition flex items-center gap-1"
                    >
                      p.{page} <ExternalLink size={10} />
                    </button>
                  ))}
                  {result.sourcePages.length > 8 && (
                    <span className="text-xs text-zinc-600">+{result.sourcePages.length - 8}</span>
                  )}
                </div>
              </div>
            ))}

            {qaResults.length === 0 && !isAnswering && (
              <div className="text-center text-zinc-500 py-8">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Ask a question about your PDF</p>
                <p className="text-xs mt-1 text-zinc-600">I'll find relevant pages and give you answers</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GLOSSARY VIEW */}
      {activeTab === 'glossary' && (
        <div className="space-y-4 h-full flex flex-col">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search terms..."
                className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {indexTerms.length === 0 && (
              <GummyButton onClick={handleScanIndex} disabled={!pdfBuffer || isScanning}>
                {isScanning ? <Loader2 className="animate-spin h-4 w-4" /> : "Scan"}
              </GummyButton>
            )}
          </div>

          {scanError && <div className="text-xs text-red-400">{scanError}</div>}

          {isScanning && (
            <div className="flex items-center justify-center gap-2 py-8 text-zinc-400">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm">Scanning document...</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {filteredTerms.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 hover:bg-white/5 rounded group">
                <span className="text-sm text-gray-300">{item.term}</span>
                <div className="flex gap-1">
                  {item.pages.slice(0, 5).map(page => (
                    <button
                      key={page}
                      onClick={() => onJumpToPage(page)}
                      className="text-xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded hover:bg-indigo-500 hover:text-white transition"
                    >
                      {page}
                    </button>
                  ))}
                  {item.pages.length > 5 && (
                    <span className="text-xs text-zinc-500">+{item.pages.length - 5}</span>
                  )}
                </div>
              </div>
            ))}
            {indexTerms.length === 0 && !isScanning && (
              <div className="text-center text-gray-500 mt-10 text-sm">
                {pdfBuffer ? "Click Scan to build index." : "Upload a PDF first."}
              </div>
            )}
          </div>

          {indexTerms.length > 0 && (
            <div className="text-xs text-zinc-500 pt-2 border-t border-white/5">
              {indexTerms.length} terms indexed
            </div>
          )}
        </div>
      )}

      {/* MINER VIEW */}
      {activeTab === 'miner' && (
        <div className="space-y-4 h-full flex flex-col">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-indigo-300 mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" /> Data Extraction
            </h4>
            <div className="space-y-2 mb-3">
              <input
                type="text"
                className="w-full bg-indigo-900/30 border border-indigo-500/30 rounded px-2 py-1 text-xs text-white"
                placeholder="Metric Name"
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
            {minerError && <p className="text-xs text-red-400 mb-2">{minerError}</p>}
            <GummyButton onClick={handleRunMiner} disabled={!pdfBuffer || isMining} className="w-full">
              {isMining ? "Extracting..." : "Run Extraction"}
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
