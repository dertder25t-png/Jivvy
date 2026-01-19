"use client";

import { useMemo, useState } from "react";
import { AppError, safeJsonStringify, toAppError } from "@/lib/errors";

export function ErrorNotice({
  error,
  className,
}: {
  error: AppError | string | unknown;
  className?: string;
}) {
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);

  const appError = useMemo(() => toAppError(error), [error]);
  const debugText = useMemo(() => safeJsonStringify(appError), [appError]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Ignore
    }
  };

  return (
    <div className={className}>
      <div className="text-xs text-red-400">{appError.message}</div>

      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowDebug(v => !v)}
          className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
        >
          Debug details
        </button>

        <button
          type="button"
          onClick={onCopy}
          className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
        >
          Copy
        </button>

        {copied && <span className="text-[10px] text-zinc-500">Copied</span>}
      </div>

      {showDebug && (
        <pre className="mt-2 max-h-40 overflow-auto text-[10px] text-zinc-300 bg-zinc-950/50 border border-white/5 rounded p-2">
          {debugText}
        </pre>
      )}
    </div>
  );
}
