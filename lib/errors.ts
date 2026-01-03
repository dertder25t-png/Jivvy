export type AppError = {
  code: string;
  message: string;
  detail?: unknown;
  retryable?: boolean;
};

const DEFAULT_UNKNOWN_MESSAGE = 'An unexpected error occurred';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function truncateString(value: string, max = 500): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

function sanitizeForLog(value: unknown, depth = 3): unknown {
  if (depth <= 0) return '[Truncated]';

  if (value == null) return value;

  if (typeof value === 'string') {
    // Avoid accidentally logging large document excerpts.
    return truncateString(value, 300);
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message, 300),
      stack: truncateString(value.stack ?? '', 1000) || undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(v => sanitizeForLog(v, depth - 1));
  }

  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value).slice(0, 30);
    for (const [k, v] of entries) {
      out[k] = sanitizeForLog(v, depth - 1);
    }
    return out;
  }

  return String(value);
}

export function createAppError(
  code: string,
  message: string,
  opts?: { detail?: unknown; retryable?: boolean }
): AppError {
  return {
    code,
    message,
    detail: opts?.detail,
    retryable: opts?.retryable,
  };
}

export function isAppError(value: unknown): value is AppError {
  if (!isRecord(value)) return false;
  return typeof value.code === 'string' && typeof value.message === 'string';
}

export function toAppError(
  input: unknown,
  fallback?: Partial<Pick<AppError, 'code' | 'message' | 'detail' | 'retryable'>>
): AppError {
  if (isAppError(input)) return input;

  // Sometimes errors are thrown as `{ code, message, ... }` but not typed.
  if (isRecord(input) && typeof input.code === 'string' && typeof input.message === 'string') {
    return {
      code: input.code,
      message: input.message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detail: 'detail' in input ? (input as any).detail : fallback?.detail,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      retryable: typeof (input as any).retryable === 'boolean' ? (input as any).retryable : fallback?.retryable,
    };
  }

  const message =
    input instanceof Error
      ? input.message
      : typeof input === 'string'
        ? input
        : fallback?.message ?? DEFAULT_UNKNOWN_MESSAGE;

  const detail =
    fallback?.detail ?? (input instanceof Error ? sanitizeForLog(input) : sanitizeForLog(input));

  return {
    code: fallback?.code ?? 'UNKNOWN',
    message: truncateString(message || DEFAULT_UNKNOWN_MESSAGE, 500),
    detail,
    retryable: fallback?.retryable,
  };
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(sanitizeForLog(value), null, 2);
  } catch {
    return JSON.stringify({ note: 'Failed to serialize value' }, null, 2);
  }
}

export function safeLogError(scope: string, error: unknown, extra?: Record<string, unknown>) {
  const appError = toAppError(error);
  const payload = {
    scope,
    code: appError.code,
    message: appError.message,
    retryable: appError.retryable,
    detail: sanitizeForLog(appError.detail),
    extra: extra ? sanitizeForLog(extra) : undefined,
  };

  // Intentionally do not log raw inputs/doc text.
  // Keep console usage so logs still show up in devtools.
  // eslint-disable-next-line no-console
  console.error('[Jivvy]', payload);
}
