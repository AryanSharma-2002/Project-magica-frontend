"use client";
import { useQuery } from "@tanstack/react-query";
import { configService } from "@/services";
import { qk } from "./keys";

/** Backend-owned limits/models/tools/skills. Long staleTime: this changes rarely. */
export function useConfig() {
  return useQuery({
    queryKey: qk.config,
    queryFn: ({ signal }) => configService.get(signal),
    staleTime: 30 * 60 * 1000,
  });
}
