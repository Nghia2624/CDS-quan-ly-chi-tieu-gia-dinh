import { ChatInterface } from "@/components/ChatInterface";

export default function ChatPage() {
  const handleSendMessage = (message: string) => {
    console.log('Chat message sent:', message);
    // todo: remove mock functionality - handle real AI chat
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chat với AI Tư vấn</h1>
        <p className="text-muted-foreground">
          Hỏi AI về chi tiêu gia đình, thống kê và lời khuyên tiết kiệm
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <ChatInterface onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}