export interface AppError {
    code: string;
    message: string;
    retryable?: boolean;
    detail?: any;
    originalError?: any;
}

export function toAppError(error: any, overrides?: Partial<AppError>): AppError {
    const base: AppError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        originalError: error
    };

    if (error instanceof Error) {
        base.message = error.message;
        base.code = (error as any).code || 'JS_ERROR';
    } else if (typeof error === 'string') {
        base.message = error;
    }

    return { ...base, ...overrides };
}

export function createAppError(code: string, message: string, detail?: any): AppError {
    return { code, message, detail };
}

export function safeJsonStringify(obj: any): string {
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return '[Circular or Non-Serializable]';
    }
}

export function safeLogError(context: string, error: any) {
    console.error(`[${context}]`, error);
}
