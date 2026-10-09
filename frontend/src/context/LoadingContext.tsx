"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GlobalLoader } from "@/components/ui/GlobalLoader";

export interface LoadingContextValue {
  /** Total count of active background requests */
  activeCount: number;
  /** Whether any global blocking loader is active */
  isGlobalLoading: boolean;
  /** Message displayed during global blocking loader */
  globalMessage: { title?: string; subtitle?: string } | null;
  /** Check if a specific named operation is currently loading */
  isLoading: (key: string) => boolean;
  /** Start a named or global loading state */
  startLoading: (key?: string, options?: { global?: boolean; title?: string; subtitle?: string }) => void;
  /** Stop a named or global loading state */
  stopLoading: (key?: string) => void;
  /** Helper to wrap any async operation with automatic start/stop and error safety */
  withLoading: <T>(
    operation: () => Promise<T>,
    options?: { key?: string; global?: boolean; title?: string; subtitle?: string }
  ) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

const AUTO_TIMEOUT_MS = 15000; // 15-second safety timeout to strictly prevent infinite loading

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [activeCount, setActiveCount] = useState<number>(0);
  const [globalMessage, setGlobalMessage] = useState<{ title?: string; subtitle?: string } | null>(null);
  
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clean up any pending timeouts on unmount
  useEffect(() => {
    const current = timeoutsRef.current;
    return () => {
      current.forEach((t) => clearTimeout(t));
      current.clear();
    };
  }, []);

  const stopLoading = useCallback((key?: string) => {
    const operationKey = key || "default_anonymous_op";

    // Clear safety timeout
    if (timeoutsRef.current.has(operationKey)) {
      clearTimeout(timeoutsRef.current.get(operationKey)!);
      timeoutsRef.current.delete(operationKey);
    }

    setActiveKeys((prev) => {
      if (!prev.has(operationKey)) return prev;
      const next = new Set(prev);
      next.delete(operationKey);
      return next;
    });

    setActiveCount((prev) => Math.max(0, prev - 1));

    // Clear global message if this was the global operation
    if (operationKey.startsWith("global_")) {
      setGlobalMessage(null);
    }
  }, []);

  const startLoading = useCallback(
    (
      key?: string,
      options?: { global?: boolean; title?: string; subtitle?: string }
    ) => {
      const operationKey = options?.global
        ? `global_${key || Date.now()}`
        : key || `op_${Date.now()}_${Math.random()}`;

      // Clear any prior timer for this key
      if (timeoutsRef.current.has(operationKey)) {
        clearTimeout(timeoutsRef.current.get(operationKey)!);
      }

      // Safety timeout: prevent infinite hanging loading states
      const timer = setTimeout(() => {
        stopLoading(operationKey);
      }, AUTO_TIMEOUT_MS);
      timeoutsRef.current.set(operationKey, timer);

      setActiveKeys((prev) => new Set(prev).add(operationKey));
      setActiveCount((prev) => prev + 1);

      if (options?.global) {
        setGlobalMessage({
          title: options.title || "Loading Academic Portal…",
          subtitle: options.subtitle || "Please wait while we fetch your data.",
        });
      }
    },
    [stopLoading]
  );

  // Listen to global network lifecycle events from apiFetch
  useEffect(() => {
    function handleFetchStart(e: Event) {
      const customEvent = e as CustomEvent<{ id: string; global?: boolean }>;
      const { id, global } = customEvent.detail || {};
      if (id) {
        startLoading(id, { global });
      }
    }

    function handleFetchEnd(e: Event) {
      const customEvent = e as CustomEvent<{ id: string; global?: boolean }>;
      const { id, global } = customEvent.detail || {};
      if (id) {
        stopLoading(global ? `global_${id}` : id);
      }
    }

    window.addEventListener("academic-portal:fetch-start", handleFetchStart);
    window.addEventListener("academic-portal:fetch-end", handleFetchEnd);

    return () => {
      window.removeEventListener("academic-portal:fetch-start", handleFetchStart);
      window.removeEventListener("academic-portal:fetch-end", handleFetchEnd);
    };
  }, [startLoading, stopLoading]);

  const isLoading = useCallback(
    (key: string) => {
      return activeKeys.has(key);
    },
    [activeKeys]
  );

  const withLoading = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options?: { key?: string; global?: boolean; title?: string; subtitle?: string }
    ): Promise<T> => {
      const key = options?.key || `op_${Date.now()}`;
      try {
        startLoading(key, options);
        return await operation();
      } finally {
        stopLoading(options?.global ? `global_${key}` : key);
      }
    },
    [startLoading, stopLoading]
  );

  const isGlobalLoading = useMemo(() => {
    for (const key of activeKeys) {
      if (key.startsWith("global_")) return true;
    }
    return false;
  }, [activeKeys]);

  const value = useMemo(
    () => ({
      activeCount,
      isGlobalLoading,
      globalMessage,
      isLoading,
      startLoading,
      stopLoading,
      withLoading,
    }),
    [
      activeCount,
      isGlobalLoading,
      globalMessage,
      isLoading,
      startLoading,
      stopLoading,
      withLoading,
    ]
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}

      {/* Subtle Top-of-screen Progress Bar for background active requests (Non-blocking) */}
      {activeCount > 0 && !isGlobalLoading && (
        <div
          role="status"
          aria-label="Background request in progress"
          className="fixed top-0 left-0 right-0 z-50 h-0.5 pointer-events-none overflow-hidden"
        >
          <div className="h-full w-full bg-gradient-to-r from-navy-900 via-brand-600 to-cyan-500 portal-shimmer" />
        </div>
      )}

      {/* Subtle Translucent Overlay only when explicitly requested (e.g. critical save/export) */}
      {isGlobalLoading && (
        <GlobalLoader
          variant="overlay"
          title={globalMessage?.title}
          subtitle={globalMessage?.subtitle}
        />
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    // Graceful fallback if called outside provider
    return {
      activeCount: 0,
      isGlobalLoading: false,
      globalMessage: null,
      isLoading: () => false,
      startLoading: () => {},
      stopLoading: () => {},
      withLoading: async <T,>(op: () => Promise<T>) => await op(),
    };
  }
  return context;
}
