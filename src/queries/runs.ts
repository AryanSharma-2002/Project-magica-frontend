"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { runsService } from "@/services";
import { qk } from "./keys";

export type UseRunOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

/** `AgentRun` (+ tool invocations, waitpoint, skills). The server is the source of truth. */
export function useRun(runId: string | null, options: UseRunOptions = {}) {
  return useQuery({
    queryKey: qk.run(runId ?? ""),
    queryFn: ({ signal }) => runsService.get(runId as string, signal),
    enabled: Boolean(runId) && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => runsService.cancel(runId),
    onSuccess: (run) => {
      queryClient.setQueryData(qk.run(run.id), run);
    },
  });
}
