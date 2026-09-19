import { AppShell } from "@/components/shell";

export default function ChatLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
