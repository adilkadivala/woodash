import dns from 'node:dns';
import net from 'node:net';
import { config } from '../config.js';

const IP_RANGES = [
    // Loopback
    { regex: /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, name: 'loopback' },
    { regex: /^::1$/, name: 'loopback' },
    // Link-local
    { regex: /^169\.254\.\d{1,3}\.\d{1,3}$/, name: 'link-local' },
    { regex: /^fe80:/i, name: 'link-local' },
    // Private IPv4
    { regex: /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, name: 'private' },
    { regex: /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/, name: 'private' },
    { regex: /^192\.168\.\d{1,3}\.\d{1,3}$/, name: 'private' },
];

/**
 * Validates an upstream URL to protect against SSRF attacks.
 * @param urlString The URL to validate.
 * @returns A promise resolving to the validation result.
 */
export async function validateUpstreamUrl(urlString: string): Promise<{ valid: boolean; reason?: string }> {
    try {
        const url = new URL(urlString);
        
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return { valid: false, reason: `Unsupported protocol: ${url.protocol}` };
        }
        
        const hostname = url.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            if (config.SSRF_ALLOW_LOCALHOST && config.NODE_ENV !== 'production') {
                return { valid: true };
            }
            return { valid: false, reason: 'Blocked loopback address' };
        }
        
        // Allow k8s service DNS
        if (hostname.endsWith('.svc') || hostname.endsWith('.svc.cluster.local')) {
            return { valid: true };
        }
        
        let addresses: string[] = [];
        // Check if hostname is an IP itself
        if (net.isIP(hostname) !== 0) {
            addresses = [hostname];
        } else {
            try {
                const resolved = await dns.promises.lookup(hostname, { all: true });
                addresses = resolved.map(res => res.address);
            } catch (err) {
                return { valid: false, reason: `DNS resolution failed for ${hostname}` };
            }
        }
        
        for (const address of addresses) {
            for (const range of IP_RANGES) {
                if (range.regex.test(address)) {
                    return { valid: false, reason: `Blocked ${range.name} address: ${address}` };
                }
            }
        }
        
        return { valid: true };
    } catch (error) {
        return { valid: false, reason: 'Invalid URL format' };
    }
}
