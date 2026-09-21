"use client";
import { useEffect, useState, type ReactNode } from "react";
import { composerKey, useComposerStore } from "@/stores/composer";
import { cn } from "cn";

type ClockValue = { clock: string; period: "am" | "pm" };

function formatClock(date: Date): ClockValue {
  const rawHours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period: ClockValue["period"] = rawHours >= 12 ? "pm" : "am";
  const hours = rawHours % 12 || 12;
  return { clock: `${hours}:${minutes}`, period };
}

/** Set only after mount so server and first client render agree (no hydration mismatch on `new Date()`). */
function useClock(): ClockValue | null {
  const [value, setValue] = useState<ClockValue | null>(null);
  useEffect(() => {
    const update = () => setValue(formatClock(new Date()));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);
  return value;
}

type SuggestionCategory = "image" | "video";
type Suggestion = {
  key: string;
  title: string;
  /** Empty = only shown on the "All" tab (a generic prompt, not tied to a media type). */
  categories: SuggestionCategory[];
  gradient: string;
};

const SUGGESTIONS: Suggestion[] = [
  { key: "generate-image", title: "Generate an image", categories: ["image"], gradient: "from-violet-100 to-indigo-50" },
  { key: "crop-photo", title: "Crop a photo", categories: ["image"], gradient: "from-amber-100 to-orange-50" },
  { key: "merge-videos", title: "Merge two videos", categories: ["video"], gradient: "from-sky-100 to-cyan-50" },
  { key: "ask-anything", title: "Ask anything", categories: [], gradient: "from-emerald-100 to-teal-50" },
];

const TABS: { key: "all" | SuggestionCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Image & Editing" },
  { key: "video", label: "Video" },
];

/**
 * New-task empty state (FIDELITY.md "Shell"): mark, local time, h1/subtitle, the composer (owned
 * by the conversation slice, passed in unchanged as `children`), then filterable suggestion cards
 * that fill the composer draft.
 */
export function EmptyState({ chatId, children }: { chatId: string | null; children: ReactNode }) {
  const time = useClock();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const setDraft = useComposerStore((s) => s.setDraft);
  const chatKey = composerKey(chatId);

  const visible = tab === "all" ? SUGGESTIONS : SUGGESTIONS.filter((s) => s.categories.includes(tab));

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pt-28 pb-10">
      <div className="mx-auto flex w-full flex-col items-center gap-6">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 text-center">
          <div
            className="flex size-12 items-center justify-center rounded-2xl bg-foreground text-lg font-semibold text-background"
            aria-hidden="true"
          >
            A
          </div>
          <p className="h-[18px] text-[13px] text-muted-foreground">
            {time && (
              <>
                {time.clock}
                <sup className="ml-0.5 text-[10px]">{time.period}</sup>
              </>
            )}
          </p>
          <h1 className="text-2xl font-bold text-foreground">Your AI worker</h1>
          <p className="text-sm font-medium text-muted-foreground">Work at the speed of thought.</p>
        </div>

        <div className="w-full max-w-(--composer-max-width)">{children}</div>

        <div className="flex w-full max-w-(--composer-max-width) flex-col gap-4">
          <div role="tablist" aria-label="Suggestion category" className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  tab === t.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {visible.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setDraft(chatKey, s.title)}
                className={cn(
                  "flex aspect-[4/5] flex-col justify-end rounded-2xl border border-border bg-gradient-to-br p-3 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  s.gradient,
                )}
                aria-label={`Start a task: ${s.title}`}
              >
                <span className="text-sm font-medium text-foreground">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
