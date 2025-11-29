/**
 * URL utility functions for handling IPv6 addresses and URL normalization
 */

/**
 * Normalizes a URL to handle IPv6 addresses properly
 * IPv6 addresses must be wrapped in brackets when used in URLs
 * @param url - The URL string to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  if (!url) return url;
  
  // Check if URL contains an IPv6 address (contains colons but not in brackets)
  // IPv6 addresses look like: 2a02:4780:2d:40f7::1
  const ipv6Pattern = /^https?:\/\/([0-9a-fA-F:]+):(\d+)/;
  const match = url.match(ipv6Pattern);
  
  if (match) {
    const ipv6Address = match[1];
    const port = match[2];
    const rest = url.substring(match[0].length);
    
    // Check if it's actually an IPv6 address (has more than one colon or contains ::)
    if (ipv6Address.includes('::') || (ipv6Address.match(/:/g) || []).length > 1) {
      // Wrap IPv6 address in brackets
      return `http${url.startsWith('https') ? 's' : ''}://[${ipv6Address}]:${port}${rest}`;
    }
  }
  
  return url;
}

/**
 * Gets the API base URL with proper IPv6 handling
 */
export function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  return normalizeUrl(baseUrl);
}

