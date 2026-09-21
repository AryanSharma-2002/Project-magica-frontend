const MICROCREDITS_PER_MILLION_CREDITS = 1_000_000;
/** Below this many microcredits, the formatted value would round to "0.00M" from a nonzero
 * balance — the reference shows "<0.01M" instead so a small balance never reads as empty. */
const BELOW_DISPLAY_THRESHOLD_MICROCREDITS = 10_000;

/**
 * Reference credits format (FIDELITY.md "Credits"): microcredits ÷ 1,000,000 → "28.45M";
 * a nonzero balance under 0.01M shows "<0.01M" instead of rounding down to "0.00M".
 */
export function formatCredits(microcredits: number): string {
  if (microcredits > 0 && microcredits < BELOW_DISPLAY_THRESHOLD_MICROCREDITS) return "<0.01M";
  const credits = microcredits / MICROCREDITS_PER_MILLION_CREDITS;
  return `${credits.toFixed(2)}M`;
}
