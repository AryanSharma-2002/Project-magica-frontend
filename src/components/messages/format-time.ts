/** "13:53" / "14:28" — 24-hour clock, per FIDELITY.md's reference screenshots. */
export function formatMessageTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  } catch {
    return "";
  }
}
