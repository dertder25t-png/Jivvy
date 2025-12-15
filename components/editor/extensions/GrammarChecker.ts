
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

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
    }
  }
}

interface GrammarCheckerOptions {
  enabled: boolean;
  onCorrection?: (original: string, corrected: string, range: { from: number, to: number }) => void;
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
        checkGrammar: () => () => {
            // Trigger check manually if needed
            return true;
        },
        setGrammarEnabled: (enabled: boolean) => ({ editor, tr, dispatch }) => {
            if (dispatch) {
                // We dispatch a transaction with meta data to update the plugin state
                editor.view.dispatch(tr.setMeta('grammarCheckerEnabled', enabled));
            }
            return true;
        }
    }
  },

  addProseMirrorPlugins() {
    // Initial state from options
    let isEnabled = this.options.enabled;
    let worker: Worker | null = null;

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

    const pluginKey = new PluginKey('grammarChecker');

    return [
      new Plugin({
        key: pluginKey,
        state: {
            init() {
                return { decorations: DecorationSet.empty, enabled: isEnabled };
            },
            apply(tr, oldState) {
                // Check for enable/disable command
                const enabledMeta = tr.getMeta('grammarCheckerEnabled');
                if (typeof enabledMeta === 'boolean') {
                    isEnabled = enabledMeta;
                    if (isEnabled) initWorker();
                    else if (worker) {
                        worker.terminate();
                        worker = null;
                    }
                    return { ...oldState, enabled: isEnabled, decorations: isEnabled ? oldState.decorations : DecorationSet.empty };
                }

                // Handle decorations from worker (meta: 'grammarCheckerDecorations')
                const decorationsMeta = tr.getMeta('grammarCheckerDecorations');
                if (decorationsMeta) {
                    return { ...oldState, decorations: decorationsMeta };
                }

                // Map decorations through changes
                if (tr.docChanged) {
                    return { ...oldState, decorations: oldState.decorations.map(tr.mapping, tr.doc) };
                }

                return oldState;
            }
        },
        view(editorView) {

            // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
            const checkGrammar = debounce((text: string, paragraphStart: number) => {
                 if (!isEnabled || !worker) return;

                 worker.onmessage = (event) => {
                     const { type, corrected, text: originalText, diffs } = event.data;
                     if (type === 'result' && corrected && corrected !== originalText) {
                         const tr = editorView.state.tr;
                         const decorations: Decoration[] = [];

                         // Use diffs if available, otherwise fallback to whole text
                         // eslint-disable-next-line @typescript-eslint/no-explicit-any
                         if (diffs && diffs.length > 0) {
                             diffs.forEach((diff: {from: number, to: number, correction: string}) => {
                                 // Diff indices are relative to the text sent (the paragraph content)
                                 // We need to map them to document positions
                                 const from = paragraphStart + diff.from;
                                 const to = paragraphStart + diff.to;

                                 decorations.push(
                                     Decoration.inline(from, to, {
                                         class: 'grammar-error border-b-2 border-red-400 cursor-pointer',
                                         'data-correction': diff.correction,
                                         title: `Suggestion: ${diff.correction}`
                                     })
                                 );
                             });
                         } else {
                             // Fallback
                             // Not ideal but better than nothing
                         }

                         // Update state with new decorations
                         // Note: We need to merge with existing decorations ideally, but for now replace for this block?
                         // Actually, we should probably keep other decorations.
                         // But simplify: Replace all decorations for now as we only check one block at a time in this demo logic.
                         // A production version would manage decorations per block.
                         editorView.dispatch(tr.setMeta('grammarCheckerDecorations', DecorationSet.create(tr.doc, decorations)));
                     }
                 };
                 worker.postMessage({ type: 'check', text });
            }, 1000);

            return {
                update(view, prevState) {
                    const state = pluginKey.getState(view.state);
                    if (!state?.enabled) return;

                    if (!view.state.doc.eq(prevState.doc)) {
                         const $pos = view.state.selection.$from;
                         // Check strictly the textblock
                         const node = $pos.parent;
                         if (!node.isTextblock) return;

                         const text = node.textContent;
                         // Start position of the node content
                         const start = $pos.start();

                         if (text.trim().length > 5) {
                             checkGrammar(text, start);
                         }
                    }
                },
                destroy() {
                    if (worker) worker.terminate();
                }
            };
        },
        props: {
            decorations(state) {
                return this.getState(state)?.decorations;
            },
            handleClickOn(view, pos, ) {
                 const state = pluginKey.getState(view.state);
                 if (!state?.decorations) return false;

                 const found = state.decorations.find(pos, pos);
                 if (found.length) {
                     const deco = found[0];
                     if (deco.spec['data-correction']) {
                         const correction = deco.spec['data-correction'];
                         const tr = view.state.tr.replaceWith(deco.from, deco.to, view.state.schema.text(correction));
                         view.dispatch(tr);
                         return true;
                     }
                 }
                 return false;
            }
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
