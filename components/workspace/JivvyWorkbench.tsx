"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  Calendar,
  Search,
  User,
  Settings,
  BookOpen,
  PenTool,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  Sparkles,
  Command,
  FileText,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Types ---
type Tab = 'notebooks' | 'canvases';
type InspectorMode = 'reference' | 'flashcards';
type NavItem = 'library' | 'schedule' | 'search';

// --- Command Palette Component ---
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette = ({ isOpen, onClose }: CommandPaletteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm transition-all duration-300 ease-out"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
          <Search className="text-zinc-500" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files, commands, or ask AI..."
            className="flex-1 bg-transparent text-white text-lg placeholder:text-zinc-600 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-zinc-500 bg-zinc-800 rounded">
            <span>ESC</span>
          </kbd>
        </div>

        <div className="p-2">
          <div className="px-2 py-1.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Recent Files</div>
          <div className="flex flex-col gap-1">
            {['Biology 101: Midterm Notes', 'Design Systems Thesis', 'Project Alpha'].map((item, i) => (
              <button
                key={i}
                className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-zinc-800 text-left transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center text-zinc-400 group-hover:text-lime-400 transition-colors">
                  <FileText size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-300 group-hover:text-white">{item}</div>
                  <div className="text-xs text-zinc-500">Edited 2h ago</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Command size={12} />
            <span>Search Mode</span>
          </div>
          <div className="flex gap-4">
             <span>Select <kbd className="font-sans">↑↓</kbd></span>
             <span>Open <kbd className="font-sans">↵</kbd></span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Mock Components ---
const JivvyLogo = () => (
  // Gradient Lime Squircle
  <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center shadow-[0_0_15px_rgba(163,230,53,0.3)]">
    <Sparkles className="text-zinc-950 fill-current" size={20} />
  </div>
);

// --- Main Workbench Component ---
const JivvyWorkbench = () => {
  const [activeTab, setActiveTab] = useState<Tab>('notebooks');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('reference');
  const [activeNav, setActiveNav] = useState<NavItem>('library');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-full bg-[#121212] text-zinc-100 flex overflow-hidden font-sans selection:bg-lime-400/30 selection:text-lime-100">

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

      {/* 1. Left Column: Global Dock (72px Fixed) */}
      <div className="w-[88px] h-full flex flex-col items-center py-6 shrink-0 z-40">
        <div className="h-full flex flex-col items-center justify-between bg-zinc-900/90 backdrop-blur border border-white/5 w-[72px] rounded-full py-6 shadow-2xl">

          {/* Top: Logo */}
          <div className="mb-6">
            <JivvyLogo />
          </div>

          {/* Middle: Navigation */}
          <div className="flex-1 flex flex-col items-center gap-6 justify-center w-full">
            <button
              onClick={() => setActiveNav('library')}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group relative active:scale-95",
                activeNav === 'library' ? "bg-zinc-800 text-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.1)]" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <Folder size={24} className={cn("transition-transform", activeNav !== 'library' && "group-hover:-rotate-3")} />
              {activeNav === 'library' && <div className="absolute inset-y-0 -left-1 w-1 h-6 my-auto bg-lime-400 rounded-full" />}
            </button>

            <button
              onClick={() => setActiveNav('schedule')}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group relative active:scale-95",
                activeNav === 'schedule' ? "bg-zinc-800 text-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.1)]" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <Calendar size={24} className={cn("transition-transform", activeNav !== 'schedule' && "group-hover:rotate-3")} />
              {activeNav === 'schedule' && <div className="absolute inset-y-0 -left-1 w-1 h-6 my-auto bg-lime-400 rounded-full" />}
            </button>

            {/* Search: Opens Command Palette */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all duration-300 active:scale-95"
            >
              <Search size={24} />
            </button>
          </div>

          {/* Bottom: User */}
          <div className="flex flex-col items-center gap-4 mt-auto">
            <button className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-95">
              <User size={20} />
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800/50 transition-all active:scale-95">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Center Column: The Stage */}
      <div className="flex-1 h-full py-4 flex flex-col min-w-0 pr-4">

        {/* Header: Scrollable Tab Bar */}
        <div className="flex items-center gap-6 px-4 mb-4 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('notebooks')}
              className={cn(
                "px-6 py-2 rounded-t-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 relative active:scale-95 border-t-2",
                activeTab === 'notebooks'
                  ? "bg-[#18181b] text-white border-lime-400 shadow-lg"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border-transparent hover:-rotate-1"
              )}
            >
              <BookOpen size={16} />
              <span>Notebooks</span>
            </button>
            <button
              onClick={() => setActiveTab('canvases')}
              className={cn(
                "px-6 py-2 rounded-t-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 relative active:scale-95 border-t-2",
                activeTab === 'canvases'
                  ? "bg-[#18181b] text-white border-lime-400 shadow-lg"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border-transparent hover:rotate-1"
              )}
            >
              <PenTool size={16} />
              <span>Canvases</span>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-lime-400/10 border border-lime-400/20 rounded-full text-lime-400 text-xs font-bold uppercase tracking-wider">
             <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
             Editing: Biology 101
          </div>
        </div>

        {/* Main View: Friendly Brutalist Card */}
        <div className="flex-1 bg-[#18181b] rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="h-14 border-b border-zinc-800/50 flex items-center justify-between px-6 shrink-0 bg-zinc-900/20">
             <div className="flex items-center gap-2 text-zinc-500">
                <span className="text-zinc-300 font-medium">Lecture 4: Cell Structure</span>
                <span className="text-zinc-700">/</span>
                <span className="text-xs">Last edited 2m ago</span>
             </div>
             <div className="flex gap-2">
                <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors active:scale-95">
                   <Clock size={18} />
                </button>
             </div>
          </div>

          {/* Content: Placeholder Text Editor */}
          <div className="flex-1 p-8 overflow-y-auto">
             <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-4xl font-bold text-white mb-8">The Mitochondria Powerhouse</h1>
                <div className="h-4 bg-zinc-800/50 rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-zinc-800/50 rounded w-full animate-pulse" />
                <div className="h-4 bg-zinc-800/50 rounded w-5/6 animate-pulse" />
                <div className="h-32 bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed flex items-center justify-center text-zinc-600">
                   Image Placeholder
                </div>
                <div className="space-y-3">
                   <div className="h-4 bg-zinc-800/50 rounded w-full animate-pulse" />
                   <div className="h-4 bg-zinc-800/50 rounded w-11/12 animate-pulse" />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* 3. Right Column: The Inspector */}
      <div
        className={cn(
          "h-full py-4 pr-4 transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] flex flex-col gap-4 overflow-hidden relative",
          inspectorOpen ? "w-[400px]" : "w-0 pr-0"
        )}
      >
        <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col relative">

          {/* Inspector Tabs */}
          <div className="p-2 flex gap-1 bg-zinc-950/30 shrink-0">
             <button
               onClick={() => setInspectorMode('reference')}
               className={cn(
                 "flex-1 py-3 rounded-2xl text-sm font-bold transition-all duration-300 active:scale-95",
                 inspectorMode === 'reference'
                   ? "bg-[#18181b] text-white shadow-lg ring-1 ring-white/5"
                   : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
               )}
             >
               Reference
             </button>
             <button
               onClick={() => setInspectorMode('flashcards')}
               className={cn(
                 "flex-1 py-3 rounded-2xl text-sm font-bold transition-all duration-300 active:scale-95",
                 inspectorMode === 'flashcards'
                   ? "bg-[#18181b] text-white shadow-lg ring-1 ring-white/5"
                   : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
               )}
             >
               Flashcards
             </button>
          </div>

          {/* Inspector Content */}
          <div className="flex-1 relative overflow-hidden">
            {inspectorMode === 'reference' ? (
              <div className="h-full flex flex-col">
                {/* Mock PDF Viewer */}
                <div className="flex-1 bg-zinc-950 m-2 rounded-2xl border border-zinc-800 relative group overflow-hidden">
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-50 group-hover:opacity-100 transition-opacity">
                      <FileText size={48} className="text-zinc-700" />
                      <p className="text-zinc-500 font-medium">Drag citations here</p>
                   </div>
                   {/* Fake PDF Lines */}
                   <div className="absolute inset-x-6 top-6 space-y-4 opacity-20 pointer-events-none">
                      <div className="h-2 bg-white rounded w-full" />
                      <div className="h-2 bg-white rounded w-5/6" />
                      <div className="h-2 bg-white rounded w-full" />
                      <div className="h-24 bg-white rounded w-full mt-8" />
                   </div>
                </div>
              </div>
            ) : (
              <div className="h-full p-4 flex flex-col gap-4">
                 {/* Flashcard Mode */}
                 <div className="bg-[#18181b] p-6 rounded-3xl border border-zinc-800 aspect-[4/3] flex flex-col justify-between shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex justify-between items-start">
                       <span className="bg-lime-400/10 text-lime-400 px-3 py-1 rounded-full text-xs font-bold">Hard</span>
                       <GraduationCap size={20} className="text-zinc-600" />
                    </div>
                    <p className="text-xl font-medium text-white text-center">
                       Define the function of the ribosome.
                    </p>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                       <div className="w-2/3 h-full bg-lime-400" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="h-12 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center px-4 text-sm text-zinc-400">
                       Next card in deck...
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* AI Context Bar */}
          <div className="p-4 bg-zinc-900/80 backdrop-blur border-t border-zinc-800 shrink-0">
             <div className="bg-gradient-to-r from-lime-400/10 to-transparent border border-lime-400/20 rounded-xl p-3 flex items-start gap-3">
                <Sparkles size={16} className="text-lime-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                   <p className="text-xs font-bold text-lime-400">AI Context</p>
                   <p className="text-xs text-zinc-400 leading-relaxed">
                      AI: &quot;I found a citation on page 4&quot;
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Inspector Toggle Button (Floating) */}
      <button
        onClick={() => setInspectorOpen(!inspectorOpen)}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-zinc-800 text-zinc-400 w-6 h-12 rounded-l-xl flex items-center justify-center border-y border-l border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all shadow-xl active:scale-95",
          inspectorOpen ? "right-[400px]" : "right-0"
        )}
      >
         {inspectorOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

    </div>
  );
};

export default JivvyWorkbench;
