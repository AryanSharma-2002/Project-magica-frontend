import { create } from "zustand";

/**
 * Composer state (F2 owns the implementation; the shape below is the seam).
 * Drafts are per chat; attachments in flight carry client-assigned `position` for stable ordering.
 */
export type PendingAttachment = {
  clientId: string;
  attachmentId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  progress: number;
  status: "queued" | "uploading" | "processing" | "ready" | "failed" | "cancelled";
  previewUrl: string | null;
  error: string | null;
};

export type ComposerState = {
  drafts: Record<string, string>;
  attachments: Record<string, PendingAttachment[]>;
  planMode: boolean;
  setDraft: (chatKey: string, text: string) => void;
  setPlanMode: (on: boolean) => void;
  setAttachments: (chatKey: string, update: (prev: PendingAttachment[]) => PendingAttachment[]) => void;
  clear: (chatKey: string) => void;
};

export const useComposerStore = create<ComposerState>((set) => ({
  drafts: {},
  attachments: {},
  planMode: false,
  setDraft: (k, text) => set((s) => ({ drafts: { ...s.drafts, [k]: text } })),
  setPlanMode: (planMode) => set({ planMode }),
  setAttachments: (k, update) => set((s) => ({ attachments: { ...s.attachments, [k]: update(s.attachments[k] ?? []) } })),
  clear: (k) => set((s) => {
    const drafts = { ...s.drafts };
    const attachments = { ...s.attachments };
    delete drafts[k];
    delete attachments[k];
    return { drafts, attachments };
  }),
}));

/** Key for a composer instance: an existing chat id or "new". */
export const composerKey = (chatId: string | null) => chatId ?? "new";
