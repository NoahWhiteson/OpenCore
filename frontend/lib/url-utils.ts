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
  
  // Check if URL already has brackets (already normalized)
  if (url.includes('[') && url.includes(']')) {
    return url;
  }
  
  // Check if URL contains an IPv6 address (contains colons but not in brackets)
  // IPv6 addresses look like: 2a02:4780:2d:40f7::1
  // IPv4 addresses look like: 72.61.3.42:3966
  const ipv6Pattern = /^(https?:\/\/)([0-9a-fA-F:]+):(\d+)(.*)$/i;
  const match = url.match(ipv6Pattern);
  
  if (match) {
    const protocol = match[1];
    const address = match[2];
    const port = match[3];
    const rest = match[4] || '';
    
    // Check if it's an IPv4 address (contains dots)
    if (address.includes('.')) {
      // IPv4 address - return as-is
      return url;
    }
    
    // Check if it's actually an IPv6 address (has more than one colon or contains ::)
    const colonCount = (address.match(/:/g) || []).length;
    if (address.includes('::') || colonCount > 1) {
      // Wrap IPv6 address in brackets
      return `${protocol}[${address}]:${port}${rest}`;
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

