"use client";
import type { AppLimits, ModelInfo, RunStatus } from "@/contracts";

/**
 * Seam between the shell (page composition, F1) and the composer (F2).
 * F2 replaces the implementation; the props are the contract and must not change without both sides.
 */
export type ComposerSendInput = { text: string; attachmentIds: string[]; planMode: boolean };

export type ComposerProps = {
  /** null = new chat; the shell creates the chat on first send. */
  chatId: string | null;
  limits: AppLimits;
  models: ModelInfo[];
  /** Status of the active run for send/stop/interrupt states; null when idle. */
  runStatus: RunStatus | null;
  disabled?: boolean;
  onSend: (input: ComposerSendInput) => Promise<void>;
  onStop: () => Promise<void>;
};

export function Composer(_props: ComposerProps) {
  return <div data-testid="composer-placeholder" className="border-t p-4 text-sm text-muted-foreground">Composer (pending)</div>;
}
