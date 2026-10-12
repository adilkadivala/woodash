const SENSITIVE_KEYS = ['password', 'secret', 'token', 'credential', 'authorization', 'key', 'hash'];

/**
 * Deeply clones an object and redacts sensitive information.
 * @param obj The object to redact.
 * @returns The redacted object.
 */
export function redactSecrets(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => redactSecrets(item));
    }
    
    if (typeof obj === 'object') {
        const redacted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
                redacted[key] = '[REDACTED]';
            } else {
                redacted[key] = redactSecrets(value);
            }
        }
        return redacted;
    }
    
    return obj;
}

/**
 * Redacts sensitive information from a URL string.
 * @param urlString The URL to redact.
 * @returns The redacted URL.
 */
export function redactUrl(urlString: string): string {
    try {
        const url = new URL(urlString);
        
        if (url.username) {
            url.username = '[REDACTED]';
        }
        if (url.password) {
            url.password = '[REDACTED]';
        }
        
        const paramsToRedact: string[] = [];
        url.searchParams.forEach((value, key) => {
            if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
                paramsToRedact.push(key);
            }
        });
        
        for (const key of paramsToRedact) {
            url.searchParams.set(key, '[REDACTED]');
        }
        
        return url.toString();
    } catch (error) {
        return urlString; // Not a valid URL, return as is
    }
}
