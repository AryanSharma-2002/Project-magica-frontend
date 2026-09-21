"use client";
import { useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DEFAULT_LIMITS, type AssetBlock, type Message, type WaitpointResolution } from "@/contracts";
import { useChat, useCreateChat } from "@/queries/chats";
import { useMessages, useRetryMessage, useSendMessage } from "@/queries/messages";
import { useConfig } from "@/queries/config";
import { useCancelRun, useRun } from "@/queries/runs";
import { waitpointsService } from "@/services";
import { useChatRun } from "@/realtime/useChatRun";
import { useUiStore } from "@/stores/ui";
import { MessageList } from "@/components/messages";
import { Composer, type ComposerSendInput } from "@/components/composer";
import { WaitpointOverlay } from "@/components/waitpoints";
import { ArtifactPanel } from "@/components/artifacts";
import { EmptyState } from "./empty-state";

function isLiveMessage(m: Message): boolean {
  return m.role === "assistant" && (m.status === "pending" || m.status === "streaming");
}

/** Shared composition for the new-chat page (`chatId === null`) and an existing chat page. */
export function ChatScreen({ chatId }: { chatId: string | null }) {
  const router = useRouter();
  const { data: chat } = useChat(chatId);
  const { data: config } = useConfig();
  const { messages, hasOlder, isFetchingOlder, fetchOlder } = useMessages(chatId);
  const createChat = useCreateChat();
  const sendMessage = useSendMessage(chatId);
  const retryMessage = useRetryMessage(chatId ?? "");
  const cancelRun = useCancelRun();

  const artifactOpen = useUiStore((s) => s.artifactPanelOpen);
  const setArtifactOpen = useUiStore((s) => s.setArtifactPanelOpen);
  const selectedAssetUrl = useUiStore((s) => s.artifactSelectedUrl);
  const openArtifact = useUiStore((s) => s.openArtifact);

  const liveMessage = messages.find(isLiveMessage) ?? null;
  const { run, live } = useChatRun(chatId, chat, liveMessage?.content ?? []);
  const liveAssistantMessageId = run && liveMessage ? liveMessage.id : null;

  const isWaiting = live.status === "waiting" && live.waitpoint?.status === "pending";
  const waitpointRun = useRun(run?.runId ?? null, { enabled: isWaiting });
  const waitpoint = isWaiting ? (waitpointRun.data?.waitpoint ?? null) : null;

  const expiredToastedForRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (run && live.error?.code === "waitpoint_expired" && expiredToastedForRunRef.current !== run.runId) {
      expiredToastedForRunRef.current = run.runId;
      toast.error("Approval timed out — send a new message to continue.");
    }
  }, [run, live.error]);

  const completeWaitpoint = useCallback(
    async (resolution: WaitpointResolution) => {
      if (!waitpoint) return;
      await waitpointsService.complete(waitpoint.id, { resolution });
      await waitpointRun.refetch();
    },
    [waitpoint, waitpointRun],
  );

  const handleSend = useCallback(
    async (input: ComposerSendInput) => {
      let targetChatId = chatId;
      if (!targetChatId) {
        try {
          const created = await createChat.mutateAsync({});
          targetChatId = created.id;
        } catch {
          toast.error("Couldn't start a new chat — try again.");
          throw new Error("Failed to create chat");
        }
        router.replace(`/chat/${targetChatId}`);
      }
      await sendMessage.mutateAsync({
        chatId: targetChatId,
        text: input.text,
        attachmentIds: input.attachmentIds,
        planMode: input.planMode,
      });
    },
    [chatId, createChat, sendMessage, router],
  );

  const handleStop = useCallback(async () => {
    if (!run) return;
    await cancelRun.mutateAsync(run.runId);
  }, [run, cancelRun]);

  const handleRetry = useCallback(
    (message: Message) => {
      if (!chatId) return;
      retryMessage.mutate(message);
    },
    [chatId, retryMessage],
  );

  const assets = useMemo(() => {
    const blocks = messages.flatMap((m) => (m.id === liveAssistantMessageId ? live.blocks : m.content));
    return blocks.filter((b): b is AssetBlock => b.type === "asset");
  }, [messages, live.blocks, liveAssistantMessageId]);

  const showEmptyState = messages.length === 0 && !isFetchingOlder;

  const composer = (
    <Composer
      chatId={chatId}
      limits={config?.limits ?? DEFAULT_LIMITS}
      models={config?.models ?? []}
      runStatus={live.status}
      disabled={sendMessage.isPending || createChat.isPending}
      onSend={handleSend}
      onStop={handleStop}
      // FIDELITY.md "Empty state": the reference composer reads differently before the first message.
      {...(showEmptyState ? { placeholder: "Assign a task or ask anything..." } : {})}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {showEmptyState ? (
          // The composer renders inline within the centered empty-state column (FIDELITY.md
          // "Empty state") instead of pinned to the bottom of the viewport.
          <EmptyState chatId={chatId}>{composer}</EmptyState>
        ) : (
          <>
            <MessageList
              messages={messages}
              liveAssistantMessageId={liveAssistantMessageId}
              live={liveAssistantMessageId ? live : null}
              hasOlder={hasOlder}
              isFetchingOlder={isFetchingOlder}
              fetchOlder={fetchOlder}
              onRetry={handleRetry}
              onOpenAsset={openArtifact}
            />

            {isWaiting && waitpoint ? (
              <div className="border-t border-border p-4">
                <WaitpointOverlay waitpoint={waitpoint} onResolve={completeWaitpoint} busy={waitpointRun.isFetching} />
              </div>
            ) : null}

            <div className="mx-auto w-full max-w-(--composer-max-width)">{composer}</div>
          </>
        )}
      </div>

      <ArtifactPanel assets={assets} open={artifactOpen} onOpenChange={setArtifactOpen} selectedUrl={selectedAssetUrl} />
    </div>
  );
}
