
import { v4 as uuidv4 } from 'uuid';

// Type definitions for worker messages
type WorkerMessage = 
    | { type: 'result'; text: string; requestId: string }
    | { type: 'error'; error: string; requestId: string }
    | { type: 'progress'; status: string; progress?: number; message?: string };

class LLMWorkerClient {
    private worker: Worker | null = null;
    private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
    private modelStatus: { status: string; progress: number } = { status: 'idle', progress: 0 };
    private listeners: ((status: any) => void)[] = [];

    constructor() {
        if (typeof window !== 'undefined') {
            this.initWorker();
        }
    }

    private initWorker() {
        if (this.worker) return;

        this.worker = new Worker(new URL('../workers/llm.worker.ts', import.meta.url));
        
        this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const data = event.data;

            if (data.type === 'result') {
                const resolver = this.pendingRequests.get(data.requestId);
                if (resolver) {
                    resolver.resolve(data.text);
                    this.pendingRequests.delete(data.requestId);
                }
            } else if (data.type === 'error') {
                const resolver = this.pendingRequests.get(data.requestId);
                if (resolver) {
                    resolver.reject(new Error(data.error));
                    this.pendingRequests.delete(data.requestId);
                }
            } else if (data.type === 'progress') {
                this.modelStatus = { 
                    status: data.status, 
                    progress: data.progress || 0 
                };
                this.notifyListeners();
                console.log(`[LLM Worker] ${data.status} ${data.progress ? `(${Math.round(data.progress)}%)` : ''} ${data.message || ''}`);
            }
        };

        this.worker.onerror = (err) => {
            console.error('LLM Worker Error:', err);
        };
    }

    public async generate(text: string, modelSize: 'flashcard-fast' | 'flashcard-balanced' = 'flashcard-fast', prompt?: string): Promise<string> {
        if (!this.worker) this.initWorker();
        
        const requestId = uuidv4();
        
        return new Promise((resolve, reject) => {
            // Relaxed timeout for local inference (120s) to accommodate model loading and slower devices
            const timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    console.warn(`[LLM Worker] Request ${requestId} timed out after 120s. Terminating worker.`);
                    this.terminate(); // Force kill the worker to stop processing
                    reject(new Error("Generation timed out (limit: 120s)"));
                }
            }, 120000);

            this.pendingRequests.set(requestId, { 
                resolve: (val) => {
                    clearTimeout(timeoutId);
                    resolve(val);
                }, 
                reject: (err) => {
                    clearTimeout(timeoutId);
                    reject(err);
                } 
            });

            this.worker?.postMessage({
                type: 'generate',
                text,
                prompt,
                modelSize,
                requestId
            });
        });
    }

    public subscribe(callback: (status: any) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.modelStatus));
    }

    public terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

// Singleton instance
export const llmClient = new LLMWorkerClient();
