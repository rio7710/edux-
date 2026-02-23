import { useCallback } from "react";

export function useDraftStorage<T>(
  storageKey: string,
  buildPayload: (values?: Record<string, unknown>) => T,
) {
  const saveDraft = useCallback(
    (values?: Record<string, unknown>) => {
      const payload = buildPayload(values);
      localStorage.setItem(storageKey, JSON.stringify(payload));
    },
    [buildPayload, storageKey],
  );

  const loadDraft = useCallback((): T | null => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
  };
}
