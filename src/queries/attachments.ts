import { useInfiniteQuery } from "@tanstack/react-query";
import type { AttachmentSource } from "@/contracts";
import { attachmentsService } from "@/services/attachments";
import { qk } from "./keys";

/**
 * Infinite listing for the composer's media-library picker (`source: "upload" | "generated"`).
 * Pages newest-first; `nextCursor` is the opaque server cursor (see contracts/pagination.ts).
 */
export function useAttachmentsLibrary(source: AttachmentSource, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.attachments({ source }),
    queryFn: ({ pageParam, signal }) => attachmentsService.list({ source, limit: 30, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}
