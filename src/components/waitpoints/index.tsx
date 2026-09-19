"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Waitpoint, WaitpointResolution, WaitpointType } from "@/contracts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatCountdown } from "@/components/tools/format";
import { ApprovalRenderer, CreditRenderer, OptionsRenderer, PlanRenderer, type WaitpointRendererProps } from "./renderers";

/** Approval / options / plan / credit overlays (F2). Rendered by the shell when a run is `waiting`. */
export type WaitpointOverlayProps = {
  waitpoint: Waitpoint;
  onResolve: (resolution: WaitpointResolution) => Promise<void>;
  busy?: boolean;
};

/** Registry: adding a waitpoint type touches only this map (+ one renderer). */
export const waitpointRenderers: Record<WaitpointType, (props: WaitpointRendererProps) => React.ReactElement | null> = {
  approval: ApprovalRenderer,
  options: OptionsRenderer,
  plan: PlanRenderer,
  credit: CreditRenderer,
};

/** `options` resolutions require >=1 selection, so there is no valid "declined" shape for Esc/backdrop. */
function declineResolutionFor(prompt: Waitpoint["prompt"]): WaitpointResolution | null {
  switch (prompt.type) {
    case "approval":
      return { type: "approval", approved: false };
    case "plan":
      return { type: "plan", approved: false };
    case "credit":
      return { type: "credit", proceed: false };
    case "options":
      return null;
  }
}

export function WaitpointOverlay(props: WaitpointOverlayProps) {
  // Keyed by waitpoint id so the double-submit guard and countdown remount fresh whenever the
  // shell swaps in a *different* waitpoint (e.g. the model asks again after a decline), rather
  // than reset via an effect (which would need a synchronous setState in that effect's body).
  return <WaitpointOverlayInner key={props.waitpoint.id} {...props} />;
}

function WaitpointOverlayInner({ waitpoint, onResolve, busy = false }: WaitpointOverlayProps) {
  const submittedRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isBusy = busy || pending;
  const { label: countdownLabel, expired } = formatCountdown(waitpoint.expiresAt, now);
  const declineResolution = useMemo(() => declineResolutionFor(waitpoint.prompt), [waitpoint.prompt]);

  const submit = useCallback(
    (resolution: WaitpointResolution) => {
      if (submittedRef.current || isBusy) return;
      submittedRef.current = true;
      setPending(true);
      void onResolve(resolution)
        .catch(() => {
          // Let the user try again after a failed submit (network error, etc).
          submittedRef.current = false;
        })
        .finally(() => setPending(false));
    },
    [isBusy, onResolve],
  );

  const Renderer = waitpointRenderers[waitpoint.prompt.type];

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          if (declineResolution) submit(declineResolution);
        }}
      >
        <Renderer prompt={waitpoint.prompt} submit={submit} busy={isBusy} countdownLabel={countdownLabel} expired={expired} />
      </DialogContent>
    </Dialog>
  );
}
