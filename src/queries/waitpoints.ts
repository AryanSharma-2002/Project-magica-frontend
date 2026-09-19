import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WaitpointResolution } from "@/contracts";
import { waitpointsService } from "@/services/waitpoints";
import { qk } from "./keys";

export type CompleteWaitpointVariables = { waitpointId: string; resolution: WaitpointResolution };

/** Wraps `waitpointsService.complete`; invalidates the run so the shell re-fetches its terminal/next state. */
export function useCompleteWaitpoint(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ waitpointId, resolution }: CompleteWaitpointVariables) =>
      waitpointsService.complete(waitpointId, { resolution }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.run(runId) });
    },
  });
}
