
'use client';
import { useState, useCallback } from 'react';
import { DataGrid } from './DataGrid';
import { Loader2, Zap, AlertCircle, Search, MessageSquare, Send, BookOpen, ExternalLink, Cpu, BarChart3, Upload } from 'lucide-react';
import { TrendChart } from './TrendChart';
import { GummyButton } from '../ui/GummyButton';
import { scanForIndex, extractAllText, extractSpecificPages } from '@/utils/pdf-extraction';
import { cn } from "@/lib/utils";

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
    if (!pdfBuffer) {
      setScanError('No PDF loaded');
      return;
    }

    if (pdfBuffer.byteLength === 0) {
      setScanError('PDF buffer is empty - please reload the file');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const bufferCopy = pdfBuffer.slice(0);
      const terms = await scanForIndex(bufferCopy);

      if (terms.length === 0) {
        setScanError('No index terms found in document');
      } else {
        setIndexTerms(terms);
      }
    } catch (error) {
      console.error('[ResearchTools] Scan error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Scan failed';
      setScanError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  }, [pdfBuffer]);

  // Ask a question
  const handleAskQuestion = useCallback(async () => {
    if (!pdfBuffer) {
      setQaError('No PDF loaded');
      return;
    }

    if (!question.trim()) {
      setQaError('Please enter a question');
      return;
    }

    setIsAnswering(true);
    setQaError(null);
    setLlmStatus('Analyzing question...');

    try {
      setLlmStatus('Extracting keywords...');
      const { extractKeywords } = await import('@/utils/local-llm');
      const searchTerms = await extractKeywords(question, (p) => setLlmStatus(p.status));

      if (searchTerms.length === 0) throw new Error('Could not extract search terms');

      setLlmStatus('Searching document...');
      const { searchPagesForTerms } = await import('@/utils/pdf-extraction');

      let searchResults: { page: number; matchCount: number }[] = [];
      try {
        searchResults = await searchPagesForTerms(pdfBuffer.slice(0), searchTerms, { maxResults: 12 });
      } catch (searchError) { console.warn('Search failed:', searchError); }

      const relevantPages = new Set<number>();
      searchResults.forEach(r => relevantPages.add(r.page));

      if (relevantPages.size === 0) {
        setLlmStatus('Scanning document overview...');
        for (let i = 1; i <= 5; i++) relevantPages.add(i);
      }

      const pagesToExtract = Array.from(relevantPages).slice(0, 8);
      setLlmStatus(`Reading pages: ${pagesToExtract.join(', ')}...`);

      const pageData = await extractSpecificPages(pdfBuffer.slice(0), pagesToExtract);
      const context = pageData.map(p => `[Page ${p.page}]\n${p.content}`).join('\n\n');

      if (!context.trim()) throw new Error('Could not extract text');

      setLlmStatus('Generating answer...');
      const { answerQuestionLocal } = await import('@/utils/local-llm');

      const answer = await answerQuestionLocal(
        question,
        context.slice(0, 5000),
        (progress) => setLlmStatus(progress.status)
      );

      setQaResults(prev => [{
        question,
        answer: answer,
        sourcePages: pagesToExtract.slice(0, 3),
        context: context.slice(0, 500) + '...'
      }, ...prev]);

      setQuestion('');
      setLlmStatus('');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get answer';
      setQaError(errorMessage);
    } finally {
      setIsAnswering(false);
      setLlmStatus('');
    }
  }, [pdfBuffer, question]);

  // Mine metrics from PDF
  const handleRunMiner = useCallback(async () => {
    if (!pdfBuffer) { setMinerError('No PDF loaded'); return; }
    if (!minerMetricName.trim()) { setMinerError('Metric name required'); return; }
    if (!minerKeywords.trim()) { setMinerError('Keywords required'); return; }

    setIsMining(true);
    setMinerError(null);

    try {
      const text = await extractAllText(pdfBuffer.slice(0));
      if (!text) throw new Error('No text extracted');

      const keywords = minerKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
      const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
      const relevantSentences = sentences.filter(sentence => keywords.some(kw => sentence.toLowerCase().includes(kw)));

      if (relevantSentences.length === 0) {
        setMetrics(prev => [...prev, {
          metric: minerMetricName,
          value: 'Not found',
          confidence: 0,
          keywords: keywords.join(', ')
        }]);
      } else {
        const numberPattern = /[\$£€]?\s*[\d,]+\.?\d*\s*%?/g;
        const numbers = relevantSentences.join(' ').match(numberPattern) || [];
        const meaningfulNumbers = numbers.filter(n => {
            const num = parseFloat(n.replace(/[,$£€\s%]/g, ''));
            return !isNaN(num) && num > 10;
        });

        setMetrics(prev => [...prev, {
          metric: minerMetricName,
          value: meaningfulNumbers[0] || relevantSentences[0].substring(0, 50) + '...',
          confidence: meaningfulNumbers.length > 0 ? 0.75 : 0.5,
          pageContext: relevantSentences[0].substring(0, 100),
          matchCount: relevantSentences.length
        }]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Extraction failed';
      setMinerError(errorMessage);
    } finally {
      setIsMining(false);
    }
  }, [pdfBuffer, minerMetricName, minerKeywords]);

  const filteredTerms = indexTerms.filter(t => t.term.toLowerCase().includes(searchTerm.toLowerCase()));

  // ZERO STATE
  if (!pdfBuffer) {
    return (
        <div className="flex flex-col h-full bg-zinc-900/30 backdrop-blur-sm p-4 rounded-3xl border border-zinc-800/50">
            {/* Disabled Tabs */}
            <div className="flex p-1 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 opacity-50 pointer-events-none mb-4">
                {['Ask AI', 'Glossary', 'Miner'].map((tab, i) => (
                    <div key={i} className={cn("flex-1 py-2.5 text-xs font-bold text-center text-zinc-600", i===0 && "text-zinc-500 bg-zinc-800/50 rounded-xl")}>
                        {tab}
                    </div>
                ))}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 border-2 border-dashed border-zinc-800 rounded-3xl m-2 bg-zinc-950/20">
                <div className="relative">
                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center shadow-2xl relative z-10">
                        <Upload size={32} className="text-zinc-600" />
                    </div>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-lime-400/10 rounded-full blur-xl animate-pulse" />
                </div>
                <div>
                    <h3 className="text-zinc-200 font-bold text-lg">No Document Loaded</h3>
                    <p className="text-zinc-500 text-sm mt-1 max-w-[200px] mx-auto leading-relaxed">
                        Upload a PDF to unlock AI analysis, smart glossary, and data mining.
                    </p>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 backdrop-blur-sm p-4 space-y-4 rounded-3xl border border-zinc-800/50">

      {/* Tab Switcher - Soft Pop Style */}
      <div className="flex p-1 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
        <button
          onClick={() => setActiveTab('qa')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
            activeTab === 'qa' ? "bg-zinc-800 text-white shadow-lg ring-1 ring-white/5" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <MessageSquare size={14} /> Ask AI
        </button>
        <button
          onClick={() => setActiveTab('glossary')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
            activeTab === 'glossary' ? "bg-zinc-800 text-white shadow-lg ring-1 ring-white/5" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <BookOpen size={14} /> Glossary
        </button>
        <button
          onClick={() => setActiveTab('miner')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
            activeTab === 'miner' ? "bg-zinc-800 text-white shadow-lg ring-1 ring-white/5" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Zap size={14} /> Miner
        </button>
      </div>

      {/* Q&A VIEW */}
      {activeTab === 'qa' && (
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          {/* Question Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about your document..."
                className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400/20 transition-all placeholder:text-zinc-600"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                disabled={isAnswering}
              />
              <GummyButton
                onClick={handleAskQuestion}
                disabled={isAnswering || !question.trim()}
                className="px-4 rounded-2xl bg-lime-400 text-black hover:bg-lime-500 shadow-none border-0"
              >
                {isAnswering ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </GummyButton>
            </div>

            {qaError && (
              <p className="text-xs text-red-400 px-2">{qaError}</p>
            )}
          </div>

          {/* Answers */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
            {isAnswering && (
              <div className="flex items-center gap-3 py-4 px-4 bg-lime-400/5 border border-lime-400/10 rounded-2xl animate-pulse">
                <Cpu className="text-lime-400" size={18} />
                <div className="flex-1">
                  <span className="text-xs font-bold text-lime-400 uppercase tracking-wider">Thinking</span>
                  <p className="text-xs text-zinc-500 mt-0.5">{llmStatus || 'Processing query...'}</p>
                </div>
              </div>
            )}

            {qaResults.map((result, idx) => (
              <div key={idx} className="bg-zinc-950/30 border border-zinc-800 rounded-3xl p-5 space-y-3 shadow-sm">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Q: {result.question}</p>
                <p className="text-sm text-zinc-200 leading-relaxed">{result.answer}</p>

                {result.sourcePages.length > 0 && (
                   <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/50">
                     <span className="text-[10px] font-bold text-zinc-600 uppercase">Sources</span>
                     {result.sourcePages.slice(0, 5).map(page => (
                       <button
                         key={page}
                         onClick={() => onJumpToPage(page)}
                         className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg hover:bg-lime-400 hover:text-black transition-colors flex items-center gap-1 active:scale-95"
                       >
                         Page {page} <ExternalLink size={8} />
                       </button>
                     ))}
                   </div>
                )}
              </div>
            ))}

            {qaResults.length === 0 && !isAnswering && (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
                <MessageSquare size={32} className="mb-3 opacity-20" />
                <p className="text-sm">No questions asked yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GLOSSARY VIEW */}
      {activeTab === 'glossary' && (
        <div className="space-y-4 h-full flex flex-col animate-in fade-in slide-in-from-bottom-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search index..."
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-lime-400 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {indexTerms.length === 0 && (
              <GummyButton onClick={handleScanIndex} disabled={isScanning} className="rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-0">
                {isScanning ? <Loader2 className="animate-spin" size={16} /> : "Scan"}
              </GummyButton>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredTerms.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 hover:bg-zinc-800/30 rounded-2xl group transition-colors border border-transparent hover:border-zinc-800">
                <span className="text-sm text-zinc-300 font-medium">{item.term}</span>
                <div className="flex gap-1">
                  {item.pages.slice(0, 3).map(page => (
                    <button
                      key={page}
                      onClick={() => onJumpToPage(page)}
                      className="text-[10px] font-bold bg-lime-400/10 text-lime-400 px-2 py-1 rounded-lg hover:bg-lime-400 hover:text-black transition-colors"
                    >
                      {page}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MINER VIEW */}
      {activeTab === 'miner' && (
        <div className="space-y-4 h-full flex flex-col animate-in fade-in slide-in-from-bottom-2">
          <div className="p-4 bg-lime-400/5 border border-lime-400/20 rounded-3xl">
            <h4 className="text-xs font-bold text-lime-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap size={14} /> Extraction Config
            </h4>
            <div className="space-y-2 mb-4">
              <input
                type="text"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none transition-colors"
                placeholder="Metric Name (e.g. Revenue)"
                value={minerMetricName}
                onChange={e => setMinerMetricName(e.target.value)}
              />
              <input
                type="text"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none transition-colors"
                placeholder="Keywords (e.g. total, gross, net)"
                value={minerKeywords}
                onChange={e => setMinerKeywords(e.target.value)}
              />
            </div>
            <GummyButton onClick={handleRunMiner} disabled={isMining} className="w-full rounded-xl bg-lime-400 text-black hover:bg-lime-500 border-0 h-10 text-sm font-bold">
              {isMining ? <Loader2 className="animate-spin mr-2" size={16} /> : <BarChart3 className="mr-2" size={16} />}
              {isMining ? "Mining..." : "Run Miner"}
            </GummyButton>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
             {metrics.length > 0 ? (
                <>
                  <DataGrid data={metrics} />
                  <div className="bg-zinc-950/30 p-4 rounded-3xl border border-zinc-800">
                    <TrendChart data={metrics} />
                  </div>
                </>
             ) : (
                <div className="text-center py-8 opacity-30">
                   <BarChart3 size={48} className="mx-auto mb-2" />
                   <p className="text-xs">No metrics extracted</p>
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
