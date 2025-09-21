import { ChatInterface } from '../ChatInterface';

export default function ChatInterfaceExample() {
  return (
    <div className="max-w-2xl mx-auto p-4">
      <ChatInterface onSendMessage={(message) => console.log('Message sent:', message)} />
    </div>
  );
}