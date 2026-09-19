import { ChatScreen } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: PageProps<"/chat/[chatId]">) {
  const { chatId } = await params;
  return <ChatScreen chatId={chatId} />;
}
