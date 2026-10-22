// Utility helper to resolve API and WebSocket endpoints across dev, production, and Android WebView environments

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  
  try {
    const custom = localStorage.getItem("arch_backend_url") || localStorage.getItem("aevi_backend_url");
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/$/, "");
    }
  } catch (e) {}

  // When loaded inside an Android WebView, local file system (file:///), or empty host
  if (window.location.protocol === "file:" || !window.location.host) {
    return "https://ais-dev-tuiqyqhi3sm47adsdutpyf-1051926126330.asia-southeast1.run.app";
  }

  return "";
}

export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return base ? `${base}${cleanEndpoint}` : cleanEndpoint;
}

export function getWsUrl(endpoint: string = "/live"): string {
  if (typeof window === "undefined") return "ws://localhost:3000/live";

  try {
    const custom = localStorage.getItem("arch_backend_url") || localStorage.getItem("aevi_backend_url");
    if (custom && custom.trim()) {
      const trimmed = custom.trim();
      const clean = trimmed.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "").replace(/\/$/, "");
      if (clean) {
        const proto = trimmed.startsWith("http://") || trimmed.startsWith("ws://") ? "ws:" : "wss:";
        return `${proto}//${clean}${endpoint}`;
      }
    }
  } catch (e) {}

  // If running in Android WebView, file://, or headless environment
  if (window.location.protocol === "file:" || !window.location.host) {
    return `wss://ais-dev-tuiqyqhi3sm47adsdutpyf-1051926126330.asia-southeast1.run.app${endpoint}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${endpoint}`;
}
