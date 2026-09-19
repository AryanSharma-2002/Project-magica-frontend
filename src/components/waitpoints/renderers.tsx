"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WaitpointPrompt, WaitpointResolution } from "@/contracts";
import { formatCredits } from "@/components/tools/format";

export type WaitpointRendererProps = {
  prompt: WaitpointPrompt;
  submit: (resolution: WaitpointResolution) => void;
  busy: boolean;
  countdownLabel: string;
  expired: boolean;
};

function CountdownRow({ label, expired }: { label: string; expired: boolean }) {
  return (
    <p role="status" className={cn("text-xs", expired ? "font-medium text-destructive" : "text-muted-foreground")}>
      {expired ? "This request has expired." : `Expires in ${label}`}
    </p>
  );
}

function jsonSummary(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ApprovalRenderer({ prompt, submit, busy, countdownLabel, expired }: WaitpointRendererProps) {
  if (prompt.type !== "approval") return null;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{prompt.title}</DialogTitle>
        {prompt.description && <DialogDescription>{prompt.description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-2 text-sm">
        <p>
          <span className="font-medium">{prompt.toolName}</span> wants to run.
        </p>
        <details className="rounded-md border p-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Input</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">{jsonSummary(prompt.input)}</pre>
        </details>
        <p className="text-muted-foreground">
          Estimated cost: <span className="font-medium text-foreground">{formatCredits(prompt.microcreditsEstimated)}</span>
        </p>
        <CountdownRow label={countdownLabel} expired={expired} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy || expired} onClick={() => submit({ type: "approval", approved: false })}>
          Decline
        </Button>
        <Button type="button" disabled={busy || expired} onClick={() => submit({ type: "approval", approved: true })}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Approve
        </Button>
      </DialogFooter>
    </>
  );
}

export function OptionsRenderer({ prompt, submit, busy, countdownLabel, expired }: WaitpointRendererProps) {
  const [selected, setSelected] = useState<string[]>([]);
  if (prompt.type !== "options") return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prompt.multi) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return [id];
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{prompt.title}</DialogTitle>
        {prompt.description && <DialogDescription>{prompt.description}</DialogDescription>}
      </DialogHeader>
      <fieldset className="space-y-2">
        <legend className="sr-only">{prompt.title}</legend>
        {prompt.options.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <label key={opt.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-sm has-[:checked]:border-primary">
              <input
                type={prompt.multi ? "checkbox" : "radio"}
                name="waitpoint-options"
                checked={checked}
                onChange={() => toggle(opt.id)}
                className="mt-0.5"
                disabled={busy || expired}
              />
              <span>
                <span className="block font-medium">{opt.label}</span>
                {opt.description && <span className="block text-xs text-muted-foreground">{opt.description}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      <CountdownRow label={countdownLabel} expired={expired} />
      <DialogFooter>
        <Button
          type="button"
          disabled={busy || expired || selected.length === 0}
          onClick={() => submit({ type: "options", selected })}
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Confirm
        </Button>
      </DialogFooter>
    </>
  );
}

export function PlanRenderer({ prompt, submit, busy, countdownLabel, expired }: WaitpointRendererProps) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  if (prompt.type !== "plan") return null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{prompt.title}</DialogTitle>
      </DialogHeader>
      <ol className="list-decimal space-y-1.5 pl-4 text-sm">
        {prompt.steps.map((step) => (
          <li key={step.id}>
            <span className="font-medium">{step.title}</span>
            {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
          </li>
        ))}
      </ol>
      {showFeedback && (
        <div className="space-y-1">
          <label htmlFor="waitpoint-plan-feedback" className="text-xs font-medium">
            What should change?
          </label>
          <Textarea id="waitpoint-plan-feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} disabled={busy} />
        </div>
      )}
      <CountdownRow label={countdownLabel} expired={expired} />
      <DialogFooter>
        {showFeedback ? (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setShowFeedback(false)}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || expired}
              onClick={() => submit({ type: "plan", approved: false, feedback: feedback.trim() || undefined })}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Send feedback
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" disabled={busy || expired} onClick={() => setShowFeedback(true)}>
              Request changes
            </Button>
            <Button type="button" disabled={busy || expired} onClick={() => submit({ type: "plan", approved: true })}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Approve plan
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}

export function CreditRenderer({ prompt, submit, busy, countdownLabel, expired }: WaitpointRendererProps) {
  if (prompt.type !== "credit") return null;
  const insufficient = prompt.microcreditsAvailable < prompt.microcreditsRequired;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{prompt.title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1 text-sm">
        <p>
          Required: <span className="font-medium">{formatCredits(prompt.microcreditsRequired)}</span>
        </p>
        <p>
          Available: <span className="font-medium">{formatCredits(prompt.microcreditsAvailable)}</span>
        </p>
        {insufficient && <p className="text-xs text-destructive">You don&apos;t have enough credits to proceed.</p>}
      </div>
      <CountdownRow label={countdownLabel} expired={expired} />
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={() => submit({ type: "credit", proceed: false })}>
          Cancel
        </Button>
        <Button type="button" disabled={busy || expired || insufficient} onClick={() => submit({ type: "credit", proceed: true })}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Proceed
        </Button>
      </DialogFooter>
    </>
  );
}
