// Utility to compute and manage public voting URLs for QR codes and mobile devices

const CUSTOM_ORIGIN_KEY = 'campus_vote_custom_origin';
const SERVER_APP_URL_KEY = 'campus_vote_server_app_url';

let configFetchPromise: Promise<string | null> | null = null;

/**
 * Checks if a hostname is a local loopback or private LAN address
 * (e.g. localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 */
export function isLocalOrPrivateHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(':')[0];
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return true;
  }
  // Private IPv4 ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

/**
 * Normalizes a base URL string by trimming, removing trailing slashes, and ensuring protocol
 */
export function normalizeBaseUrl(url: string): string {
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  return clean;
}

/**
 * Asynchronously fetch configured public application URL from the server API
 * (Supports runtime APP_URL injection on Cloud Run / container hosts without rebuilding frontend assets)
 */
export async function fetchServerConfiguredUrl(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (configFetchPromise) return configFetchPromise;

  configFetchPromise = (async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (
          data.appUrl &&
          typeof data.appUrl === 'string' &&
          data.appUrl.trim() &&
          data.appUrl !== 'MY_APP_URL'
        ) {
          const normalized = normalizeBaseUrl(data.appUrl);
          sessionStorage.setItem(SERVER_APP_URL_KEY, normalized);
          return normalized;
        }
      }
    } catch {
      // Graceful fallback
    }
    return null;
  })();

  return configFetchPromise;
}

// Background detection of server-configured URL
if (typeof window !== 'undefined') {
  fetchServerConfiguredUrl()
    .then((serverUrl) => {
      if (serverUrl) {
        window.dispatchEvent(
          new CustomEvent('campus_vote_url_changed', { detail: { url: serverUrl } })
        );
      }
    })
    .catch(() => {});
}

/**
 * Resolves the public base URL for QR codes according to architectural rules:
 *
 * 1. Environment Variable (VITE_APP_URL or APP_URL):
 *    If explicitly configured in build env or server runtime, this public domain is used.
 *
 * 2. User-configured Custom Override:
 *    If host explicitly sets a custom domain/tunnel in the UI settings, it is respected.
 *
 * 3. Deployed Production Domain:
 *    When running in production on a real domain (e.g. Cloud Run, Vercel, campus custom domain),
 *    window.location.origin is already a publicly reachable HTTPS domain.
 *
 * 4. Local Development Fallback:
 *    When running on localhost during development without an env var, uses the local origin
 *    (e.g. http://localhost:3000) so development works seamlessly without hardcoding.
 */
export function getResolvedBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. Build-time configured VITE_APP_URL
  const buildEnvUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (buildEnvUrl && buildEnvUrl !== 'MY_APP_URL') {
    return normalizeBaseUrl(buildEnvUrl);
  }

  // 2. Runtime server-injected APP_URL
  const runtimeServerUrl = sessionStorage.getItem(SERVER_APP_URL_KEY);
  if (runtimeServerUrl && runtimeServerUrl.trim()) {
    return normalizeBaseUrl(runtimeServerUrl);
  }

  // 3. User-configured custom URL / tunnel override from settings modal
  const userCustom = localStorage.getItem(CUSTOM_ORIGIN_KEY);
  if (userCustom && userCustom.trim()) {
    return normalizeBaseUrl(userCustom);
  }

  const origin = window.location.origin;
  const hostname = window.location.hostname;

  // 4. Deployed Production Domain (Not localhost, 127.0.0.1, or private LAN)
  // Window origin on deployed host (e.g. https://ais-pre-...run.app) is publicly reachable
  if (!isLocalOrPrivateHost(hostname)) {
    return origin;
  }

  // 5. Local Development Fallback (e.g. http://localhost:3000)
  return origin;
}

/**
 * Constructs the canonical public voting URL for a given poll
 * Format: ${APP_URL}/poll/${pollId}
 */
export function getPublicVotingUrl(pollIdOrCode: string): string {
  const base = getResolvedBaseUrl();
  const cleanId = encodeURIComponent((pollIdOrCode || '').trim());
  return `${base}/poll/${cleanId}`;
}

export function getUrlDiagnostics() {
  if (typeof window === 'undefined') {
    return {
      currentOrigin: '',
      isLocalhost: false,
      customOrigin: null,
      configuredEnvUrl: null,
      activeBaseUrl: '',
      source: 'local' as const,
    };
  }

  const origin = window.location.origin;
  const hostname = window.location.hostname;
  const isLocal = isLocalOrPrivateHost(hostname);
  const customOrigin = localStorage.getItem(CUSTOM_ORIGIN_KEY);
  const buildEnvUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  const runtimeServerUrl = sessionStorage.getItem(SERVER_APP_URL_KEY);
  const activeBaseUrl = getResolvedBaseUrl();

  const configuredEnvUrl =
    buildEnvUrl && buildEnvUrl !== 'MY_APP_URL'
      ? buildEnvUrl
      : runtimeServerUrl || null;

  let source: 'env' | 'custom' | 'production' | 'local' = 'local';
  if (configuredEnvUrl && activeBaseUrl === normalizeBaseUrl(configuredEnvUrl)) {
    source = 'env';
  } else if (customOrigin && activeBaseUrl === normalizeBaseUrl(customOrigin)) {
    source = 'custom';
  } else if (!isLocal) {
    source = 'production';
  } else {
    source = 'local';
  }

  return {
    currentOrigin: origin,
    isLocalhost: isLocal,
    customOrigin,
    configuredEnvUrl,
    activeBaseUrl,
    source,
  };
}

export function setCustomBaseUrl(url: string | null): void {
  if (typeof window === 'undefined') return;

  if (!url || !url.trim()) {
    localStorage.removeItem(CUSTOM_ORIGIN_KEY);
  } else {
    localStorage.setItem(CUSTOM_ORIGIN_KEY, normalizeBaseUrl(url));
  }

  window.dispatchEvent(new CustomEvent('campus_vote_url_changed', { detail: { url } }));
}

