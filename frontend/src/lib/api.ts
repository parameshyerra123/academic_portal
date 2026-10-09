export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export type ApiFetchOptions = RequestInit & {
  /** If true, triggers global overlay loader */
  globalLoader?: boolean;
  /** If true, bypasses loading indicator tracking */
  skipLoader?: boolean;
};

/**
 * Browser/API fetch that always sends the HTTP-only session cookie.
 * Integrates with the portal loading system for tracking concurrent requests.
 */
export async function apiFetch(path: string, init: ApiFetchOptions = {}) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  if (
    init.body != null &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const isBrowser = typeof window !== "undefined";
  const shouldTrack = isBrowser && !init.skipLoader;
  const requestId = shouldTrack
    ? `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    : null;

  if (shouldTrack && requestId) {
    window.dispatchEvent(
      new CustomEvent("academic-portal:fetch-start", {
        detail: { id: requestId, global: Boolean(init.globalLoader) },
      })
    );
  }

  try {
    return await fetch(url, {
      ...init,
      headers,
      credentials: "include",
      cache: init.cache ?? "no-store",
    });
  } finally {
    if (shouldTrack && requestId) {
      window.dispatchEvent(
        new CustomEvent("academic-portal:fetch-end", {
          detail: { id: requestId, global: Boolean(init.globalLoader) },
        })
      );
    }
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
