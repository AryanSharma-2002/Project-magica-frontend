import { QueryClient } from "@tanstack/react-query";

/** A QueryClient tuned for tests: no retries, no caching surprises between assertions. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}
