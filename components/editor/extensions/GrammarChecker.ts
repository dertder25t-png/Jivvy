/**
 * GrammarChecker Extension (DISABLED)
 * 
 * This extension has been disabled to improve performance.
 * The grammar worker was causing lag and unauthorized file access errors.
 * This stub maintains API compatibility while doing nothing.
 */

import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    grammarChecker: {
      checkGrammar: () => ReturnType;
      setGrammarEnabled: (enabled: boolean) => ReturnType;
      applyGrammarSuggestions: () => ReturnType;
      dismissGrammarSuggestions: () => ReturnType;
      rerunGrammarCheck: () => ReturnType;
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
      // All commands are no-ops now
      checkGrammar: () => () => true,
      setGrammarEnabled: () => () => true,
      applyGrammarSuggestions: () => () => true,
      dismissGrammarSuggestions: () => () => true,
      rerunGrammarCheck: () => () => true,
    };
  },

  // No plugins - grammar checking is disabled
  addProseMirrorPlugins() {
    return [];
  },
});
