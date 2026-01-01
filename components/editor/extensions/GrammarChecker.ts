
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { toAppError, type AppError } from '@/lib/errors';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    grammarChecker: {
      /**
       * Check grammar
       */
      checkGrammar: () => ReturnType;
      /**
       * Set grammar checker enabled state
       */
      setGrammarEnabled: (enabled: boolean) => ReturnType;

            /** Apply the latest suggestions (trust-based; explicit action) */
            applyGrammarSuggestions: () => ReturnType;

            /** Dismiss the latest suggestions */
            dismissGrammarSuggestions: () => ReturnType;

            /** Re-run the grammar check for the current textblock */
            rerunGrammarCheck: () => ReturnType;
    }
  }
}

interface GrammarCheckerOptions {
  enabled: boolean;
  onCorrection?: (original: string, corrected: string, range: { from: number, to: number }) => void;
}

type GrammarSuggestion = {
    paragraphStart: number;
    paragraphEnd: number;
    originalText: string;
    correctedText: string;
    diffs: Array<{ from: number; to: number; correction: string }>;
    createdAt: number;
};

type GrammarCheckerState = {
    decorations: DecorationSet;
    enabled: boolean;
    status: 'idle' | 'pending' | 'ready' | 'error';
    suggestion: GrammarSuggestion | null;
    error: AppError | null;
};

const grammarPluginKey = new PluginKey<GrammarCheckerState>('grammarChecker');

const GRAMMAR_TIMEOUT_MS = 20_000;
const GRAMMAR_DEBOUNCE_MS = 30_000;
const EVENT_NAME = 'jivvy:tidy-state';

function emitTidyState(detail: {
    status: GrammarCheckerState['status'];
    suggestion?: GrammarSuggestion | null;
    error?: AppError | null;
}) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export const GrammarChecker = Extension.create<GrammarCheckerOptions>({
  name: 'grammarChecker',

  addOptions() {
    return {
      enabled: false,
      onCorrection: undefined,
    };
  },

  addCommands() {
    return {
        checkGrammar: () => ({ editor }) => {
            // Trigger check manually (for current selection's textblock)
            const tr = editor.view.state.tr.setMeta('grammarCheckerRun', true);
            editor.view.dispatch(tr);
            return true;
        },
        setGrammarEnabled: (enabled: boolean) => ({ editor, tr, dispatch }) => {
            if (dispatch) {
                // We dispatch a transaction with meta data to update the plugin state
                editor.view.dispatch(tr.setMeta('grammarCheckerEnabled', enabled));
            }
            return true;
        },

        applyGrammarSuggestions: () => ({ editor }) => {
                        const state = grammarPluginKey.getState(editor.view.state);
                        const suggestion = state?.suggestion;
                        if (!suggestion || !suggestion.diffs?.length) return true;

                        // Keep snapshot before applying (for UI/debug + undo stack)
                        emitTidyState({ status: 'pending', suggestion, error: null });

                        // Apply diffs from end -> start so positions remain stable.
                        const diffs = [...suggestion.diffs].sort((a, b) => b.from - a.from);
                        let tr = editor.view.state.tr;
                        for (const diff of diffs) {
                            const from = suggestion.paragraphStart + diff.from;
                            const to = suggestion.paragraphStart + diff.to;
                            tr = tr.replaceWith(from, to, editor.view.state.schema.text(diff.correction));
                        }

                        // Clear suggestions after applying
                        tr = tr
                            .setMeta('grammarCheckerDecorations', DecorationSet.empty)
                            .setMeta('grammarCheckerDismiss', true);

                        editor.view.dispatch(tr);
            return true;
        },

        dismissGrammarSuggestions: () => ({ editor }) => {
            const tr = editor.view.state.tr.setMeta('grammarCheckerDismiss', true);
            editor.view.dispatch(tr);
            return true;
        },

        rerunGrammarCheck: () => ({ editor }) => {
            const tr = editor.view.state.tr.setMeta('grammarCheckerRerun', true);
            editor.view.dispatch(tr);
            return true;
        },
    }
  },

  addProseMirrorPlugins() {
    // Initial state from options
    let isEnabled = this.options.enabled;
    let worker: Worker | null = null;

        let activeRequestId: string | null = null;
        let activeTimeout: ReturnType<typeof setTimeout> | null = null;

    const initWorker = () => {
        if (typeof window !== 'undefined' && !worker) {
            worker = new Worker(new URL('../../../workers/grammar.worker.ts', import.meta.url), {
                type: 'module'
            });
        }
    };

    if (isEnabled) {
        initWorker();
    }

    return [
      new Plugin({
                key: grammarPluginKey,
        state: {
                        init(): GrammarCheckerState {
                                return {
                                    decorations: DecorationSet.empty,
                                    enabled: isEnabled,
                                    status: 'idle',
                                    suggestion: null,
                                    error: null,
                                };
                        },
                        apply(tr, old: GrammarCheckerState): GrammarCheckerState {

                // Check for enable/disable command
                const enabledMeta = tr.getMeta('grammarCheckerEnabled');
                if (typeof enabledMeta === 'boolean') {
                    isEnabled = enabledMeta;
                    if (isEnabled) initWorker();
                    else if (worker) {
                        worker.terminate();
                        worker = null;
                    }

                                        const next: GrammarCheckerState = {
                                            ...old,
                                            enabled: isEnabled,
                                            decorations: isEnabled ? old.decorations : DecorationSet.empty,
                                            status: isEnabled ? old.status : 'idle',
                                            suggestion: isEnabled ? old.suggestion : null,
                                            error: isEnabled ? old.error : null,
                                        };

                                        if (!isEnabled) {
                                            emitTidyState({ status: 'idle', suggestion: null, error: null });
                                        }

                                        return next;
                }

                                // Apply / dismiss / rerun actions
                                if (tr.getMeta('grammarCheckerDismiss')) {
                                    emitTidyState({ status: 'idle', suggestion: null, error: null });
                                    return {
                                        ...old,
                                        status: 'idle',
                                        suggestion: null,
                                        error: null,
                                        decorations: DecorationSet.empty,
                                    };
                                }

                                if (tr.getMeta('grammarCheckerRerun') || tr.getMeta('grammarCheckerRun')) {
                                    // Mark pending; actual run happens in the plugin view `update()`.
                                    emitTidyState({ status: 'pending', suggestion: old.suggestion, error: null });
                                    return { ...old, status: 'pending', error: null };
                                }

                // Handle decorations from worker (meta: 'grammarCheckerDecorations')
                const decorationsMeta = tr.getMeta('grammarCheckerDecorations');
                if (decorationsMeta) {
                                        return { ...old, decorations: decorationsMeta };
                }

                                const suggestionMeta = tr.getMeta('grammarCheckerSuggestion') as GrammarSuggestion | undefined;
                                if (suggestionMeta) {
                                    emitTidyState({ status: 'ready', suggestion: suggestionMeta, error: null });
                                    return {
                                        ...old,
                                        status: 'ready',
                                        suggestion: suggestionMeta,
                                        error: null,
                                    };
                                }

                                const errorMeta = tr.getMeta('grammarCheckerError') as AppError | undefined;
                                if (errorMeta) {
                                    emitTidyState({ status: 'error', suggestion: old.suggestion, error: errorMeta });
                                    return {
                                        ...old,
                                        status: 'error',
                                        error: errorMeta,
                                    };
                                }

                // Map decorations through changes
                if (tr.docChanged) {
                                        return { ...old, decorations: old.decorations.map(tr.mapping, tr.doc) };
                }

                                return old;
            }
        },
        view(editorView) {

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
                        const runCheck = debounce((text: string, paragraphStart: number, paragraphEnd: number) => {
                                 if (!isEnabled) return;
                                 initWorker();
                                 if (!worker) return;

                                 // Cancel any previous in-flight
                                 if (activeTimeout) {
                                     clearTimeout(activeTimeout);
                                     activeTimeout = null;
                                 }

                                 const requestId = crypto.randomUUID();
                                 activeRequestId = requestId;

                                 // Update UI state: pending
                                 emitTidyState({ status: 'pending', suggestion: null, error: null });

                                 activeTimeout = setTimeout(() => {
                                     if (activeRequestId !== requestId) return;
                                     const err = toAppError(new Error('Grammar worker timeout'), {
                                         code: 'WORKER_TIMEOUT',
                                         message: 'Grammar worker timed out',
                                         retryable: true,
                                         detail: { timeoutMs: GRAMMAR_TIMEOUT_MS },
                                     });
                                     editorView.dispatch(editorView.state.tr.setMeta('grammarCheckerError', err));
                                 }, GRAMMAR_TIMEOUT_MS);

                                 worker.onmessage = (event) => {
                                         const { type, corrected, text: originalText, diffs, error, requestId: respId } = event.data;
                                         if (respId && respId !== requestId) return;

                                         if (activeTimeout) {
                                             clearTimeout(activeTimeout);
                                             activeTimeout = null;
                                         }

                                         if (type === 'error') {
                                             editorView.dispatch(editorView.state.tr.setMeta('grammarCheckerError', toAppError(error, {
                                                 code: 'WORKER_GRAMMAR_FAILED',
                                                 message: 'Grammar check failed',
                                                 retryable: true,
                                             })));
                                             return;
                                         }

                                         if (type === 'result') {
                                                 if (!corrected || corrected === originalText) {
                                                     // Clear existing suggestions if any
                                                     editorView.dispatch(
                                                         editorView.state.tr
                                                             .setMeta('grammarCheckerDecorations', DecorationSet.empty)
                                                             .setMeta('grammarCheckerDismiss', true)
                                                     );
                                                     return;
                                                 }

                                                 const tr = editorView.state.tr;
                                                 const decorations: Decoration[] = [];

                                                 // Use diffs if available
                                                 const normalizedDiffs: Array<{ from: number; to: number; correction: string }> =
                                                     Array.isArray(diffs) ? diffs : [];

                                                 if (normalizedDiffs.length > 0) {
                                                         normalizedDiffs.forEach((diff) => {
                                                                 const from = paragraphStart + diff.from;
                                                                 const to = paragraphStart + diff.to;

                                                                 decorations.push(
                                                                         Decoration.inline(from, to, {
                                                                                 class: 'grammar-error border-b-2 border-red-400',
                                                                                 title: `Suggestion available`
                                                                         })
                                                                 );
                                                         });
                                                 }

                                                 const suggestion: GrammarSuggestion = {
                                                     paragraphStart,
                                                     paragraphEnd,
                                                     originalText: String(originalText ?? ''),
                                                     correctedText: String(corrected ?? ''),
                                                     diffs: normalizedDiffs,
                                                     createdAt: Date.now(),
                                                 };

                                                 editorView.dispatch(
                                                     tr
                                                         .setMeta('grammarCheckerDecorations', DecorationSet.create(tr.doc, decorations))
                                                         .setMeta('grammarCheckerSuggestion', suggestion)
                                                 );
                                         }
                                 };

                                 worker.postMessage({ type: 'check', text, requestId });
                        }, GRAMMAR_DEBOUNCE_MS);

            return {
                update(view, prevState) {
                    const state = grammarPluginKey.getState(view.state);
                    if (!state?.enabled) return;

                    if (!view.state.doc.eq(prevState.doc)) {
                         const $pos = view.state.selection.$from;
                         // Check strictly the textblock
                         const node = $pos.parent;
                         if (!node.isTextblock) return;

                         const text = node.textContent;
                         // Start position of the node content
                         const start = $pos.start();
                         const end = start + node.nodeSize - 2; // textblock content end

                         if (text.trim().length > 5) {
                             runCheck(text, start, end);
                         }
                    }

                    // If a manual run was requested, the state will be pending.
                    const current = grammarPluginKey.getState(view.state);
                    if (current?.status === 'pending') {
                      const $pos = view.state.selection.$from;
                      const node = $pos.parent;
                      if (!node.isTextblock) return;
                      const text = node.textContent;
                      const start = $pos.start();
                      const end = start + node.nodeSize - 2;
                      if (text.trim().length > 5) {
                        runCheck(text, start, end);
                      }
                    }
                },
                destroy() {
                    if (worker) worker.terminate();
                    if (activeTimeout) clearTimeout(activeTimeout);
                }
            };
        },
        props: {
            decorations(state) {
                return this.getState(state)?.decorations;
            },
            // Trust-based: do not auto-apply on click.
        }
      }),
    ];
  },
});

// Helper for debouncing
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function debounce(func: Function, wait: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let timeout: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function(...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
