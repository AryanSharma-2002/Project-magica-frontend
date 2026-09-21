import { toast } from "sonner";
import { blocksToPlainText, type Message } from "@/contracts";

/** Shared by the user-bubble hover action and the assistant footer's copy icon. */
export async function copyMessage(message: Message): Promise<void> {
  try {
    await navigator.clipboard.writeText(blocksToPlainText(message.content));
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Couldn't copy — try selecting the text instead");
  }
}
