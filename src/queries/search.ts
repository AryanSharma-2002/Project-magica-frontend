"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchService } from "@/services";
import { PAGE_LIMIT_DEFAULT } from "@/contracts";
import { qk } from "./keys";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Debounced (default 300ms) search over chat titles + message text. */
export function useSearch(query: string, options: { enabled?: boolean; debounceMs?: number } = {}) {
  const debounced = useDebouncedValue(query.trim(), options.debounceMs ?? 300);
  return useQuery({
    queryKey: qk.search(debounced),
    queryFn: ({ signal }) => searchService.search({ q: debounced, limit: PAGE_LIMIT_DEFAULT }, signal),
    enabled: debounced.length > 0 && (options.enabled ?? true),
  });
}
