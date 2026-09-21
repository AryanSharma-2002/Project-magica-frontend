"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "cn";
import type { TextBlock } from "@/contracts";

/**
 * react-markdown never renders raw HTML unless rehype-raw is added — deliberately not added, so
 * this is safe against injected markup. No typography plugin is installed, so markdown elements
 * get sane spacing via plain utility classes rather than a `prose` class that would be a no-op.
 *
 * Size is variant-driven rather than hardcoded (FIDELITY.md "Conversation"): the user bubble is
 * 14px/20px, assistant prose is 16px/28px. The parent (message-bubble.tsx) decides which.
 */
export function TextBlockView({ block, variant = "assistant" }: { block: TextBlock; variant?: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "max-w-none space-y-2 break-words [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5",
        variant === "user" ? "text-sm leading-5" : "text-base leading-7",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
    </div>
  );
}
