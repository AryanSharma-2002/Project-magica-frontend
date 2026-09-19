"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { chatsService } from "@/services";
import { PAGE_LIMIT_DEFAULT, type Chat, type Page } from "@/contracts";
import { qk } from "./keys";

export type ChatFilters = { pinned?: boolean; q?: string };
type ChatsListData = InfiniteData<Page<Chat>>;

/**
 * Infinite chat list. `filters.pinned` only ever sends `true` (never `false`): `ListChatsQuery.pinned`
 * is `z.coerce.boolean()`, so a literal `"false"` query string would coerce back to `true`. Omitting
 * the param returns the unfiltered list; the sidebar partitions pinned/unpinned client-side.
 */
export function useChats(filters: ChatFilters = {}) {
  return useInfiniteQuery({
    queryKey: qk.chats.list(filters),
    queryFn: ({ pageParam, signal }) =>
      chatsService.list(
        {
          limit: PAGE_LIMIT_DEFAULT,
          cursor: pageParam,
          pinned: filters.pinned === true ? true : undefined,
          q: filters.q,
        },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useChat(chatId: string | null) {
  return useQuery({
    queryKey: qk.chats.detail(chatId ?? ""),
    queryFn: ({ signal }) => chatsService.get(chatId as string, signal),
    enabled: Boolean(chatId),
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string } = {}) => chatsService.create(body),
    onSuccess: (chat) => {
      queryClient.setQueryData(qk.chats.detail(chat.id), chat);
      void queryClient.invalidateQueries({ queryKey: qk.chats.all });
    },
  });
}

function patchChatInList(data: ChatsListData, chatId: string, patch: Partial<Chat>): ChatsListData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((c) => (c.id === chatId ? { ...c, ...patch } : c)),
    })),
  };
}

export type UpdateChatPatch = { title?: string; pinned?: boolean };

/** Rename / pin with an optimistic update, rolled back on error. */
export function useUpdateChat(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateChatPatch) => chatsService.update(chatId, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: qk.chats.detail(chatId) });
      await queryClient.cancelQueries({ queryKey: ["chats", "list"] });

      const previousDetail = queryClient.getQueryData<Chat>(qk.chats.detail(chatId));
      const previousLists = queryClient.getQueriesData<ChatsListData>({ queryKey: ["chats", "list"] });

      if (previousDetail) queryClient.setQueryData(qk.chats.detail(chatId), { ...previousDetail, ...patch });
      for (const [key, data] of previousLists) {
        if (!data) continue;
        queryClient.setQueryData<ChatsListData>(key, patchChatInList(data, chatId, patch));
      }
      return { previousDetail, previousLists };
    },
    onError: (_err, _patch, context) => {
      if (context?.previousDetail) queryClient.setQueryData(qk.chats.detail(chatId), context.previousDetail);
      for (const [key, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.chats.all });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => chatsService.remove(chatId),
    onSuccess: (_result, chatId) => {
      queryClient.removeQueries({ queryKey: qk.chats.detail(chatId) });
      void queryClient.invalidateQueries({ queryKey: ["chats", "list"] });
    },
  });
}

export function primeChatDetail(queryClient: QueryClient, chat: Chat): void {
  queryClient.setQueryData(qk.chats.detail(chat.id), chat);
}
