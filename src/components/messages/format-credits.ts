/**
 * Message-footer credits format ("28.45M credits"), per FIDELITY.md "Conversation §6".
 *
 * NOTE for merge: this duplicates the signature of `formatCredits` that the shell slice (f3) adds
 * to `src/lib/format.ts` (microcredits -> "N.NNM"). Once that file lands, delete this one and
 * import from `@/lib/format` instead — see the final report.
 */
export function formatCredits(microcredits: number): string {
  if (microcredits === 0) return "0.00M";
  const millions = microcredits / 1_000_000;
  if (millions < 0.01) return "<0.01M";
  return `${millions.toFixed(2)}M`;
}
