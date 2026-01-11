'use client';

import React, { createContext, useContext, useRef, useEffect } from 'react';

/**
 * WorkersContext - Global Worker Manager
 * 
 * Centralizes Web Worker lifecycle management to prevent:
 * - Worker reload thrashing on navigation
 * - Memory leaks from orphaned workers
 * - Redundant worker instances
 * 
 * Note: Grammar worker has been removed. This context is kept for future workers.
 */

interface WorkersContextValue {
  // Reserved for future workers (e.g., flashcard generation worker)
}

const WorkersContext = createContext<WorkersContextValue | null>(null);

interface WorkersProviderProps {
  children: React.ReactNode;
}

export function WorkersProvider({ children }: WorkersProviderProps) {
  return (
    <WorkersContext.Provider value={{}}>
      {children}
    </WorkersContext.Provider>
  );
}

export function useWorkers(): WorkersContextValue {
  const context = useContext(WorkersContext);
  if (!context) {
    throw new Error('useWorkers must be used within a WorkersProvider');
  }
  return context;
}
