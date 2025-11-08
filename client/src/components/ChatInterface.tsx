import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Bot, User, RefreshCw, Trash2, Lightbulb, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface ChatInterfaceProps {
  onSendMessage?: (message: string) => void;
}

export function ChatInterface({ onSendMessage }: ChatInterfaceProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isStopped, setIsStopped] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const quickQuestions = [
    "Tôi nên tiết kiệm như thế nào?",
    "Phân tích chi tiêu tháng này",
    "Gợi ý ngân sách hợp lý",
    "Cách giảm chi phí ăn uống",
    "Đầu tư thông minh cho gia đình"
  ];

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // First, try to get existing sessions
        const sessionsRes = await apiService.getChatSessions();
        if (!active) return;
        
        if (sessionsRes.sessions && sessionsRes.sessions.length > 0) {
          // Use the most recent session
          const latestSession = sessionsRes.sessions[0];
          setCurrentSessionId(latestSession.id);
          
          // Load messages for this session
          const messagesRes = await apiService.getChatHistory(latestSession.id);
          const items = (messagesRes.messages || []).map((m: any) => ({
            id: m.id,
            text: m.message || m.response || "",
            sender: (m.messageType === "user" ? "user" : "ai") as "user" | "ai",
            timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
          })) as Message[];
          setMessages(items);
        } else {
          // Create a new session
          const newSession = await apiService.createChatSession() as any;
          setCurrentSessionId(newSession.session.id);
          setMessages([]);
        }
      } catch (err: any) {
        console.error('Error initializing chat:', err);
        toast({ title: "Không tải được lịch sử chat", description: err.message, variant: "destructive" });
      }
    })();
    return () => { active = false; };
  }, [toast]);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!message.trim() || !currentSessionId || isStopped) return;

    const userMessage: Message = {
      id: `local-${Date.now()}`,
      text: message.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setIsTyping(true);
    setIsStopped(false);

    // Create AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const res: any = await apiService.sendChatMessage(currentSessionId, userMessage.text);
      
      // Check if stopped before adding AI message
      if (!isStopped && !abortControllerRef.current?.signal.aborted) {
        const aiMessage: Message = {
          id: res.aiMessage?.id || `ai-${Date.now()}`,
          text: res.response || "Xin lỗi, tôi chưa có câu trả lời.",
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        onSendMessage?.(userMessage.text);
      }
    } catch (err: any) {
      if (!abortControllerRef.current?.signal.aborted) {
        console.error('Error sending message:', err);
        toast({ title: "Lỗi gửi tin nhắn", description: err.message, variant: "destructive" });
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStopped(true);
    setIsTyping(false);
    toast({ title: "Đã dừng chat", description: "Đã dừng phản hồi AI" });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (question: string) => {
    setMessage(question);
  };

  const handleClearChat = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử chat?")) {
      try {
        setIsLoading(true);
        // Clear local messages
        setMessages([]);
        toast({ title: "Đã xóa lịch sử chat" });
      } catch (error) {
        toast({ title: "Lỗi", description: "Không thể xóa lịch sử chat", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRefreshChat = async () => {
    try {
      setIsLoading(true);
      if (currentSessionId) {
        const res = await apiService.getChatHistory(currentSessionId);
        const items = (res.messages || []).map((m: any) => ({
          id: m.id,
          text: m.message || m.response || "",
          sender: (m.messageType === "user" ? "user" : "ai") as "user" | "ai",
          timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
        })) as Message[];
        setMessages(items);
        toast({ title: "Đã làm mới lịch sử chat" });
      }
    } catch (err: any) {
      toast({ title: "Lỗi", description: "Không thể tải lịch sử chat", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-[600px] flex flex-col shadow-xl border-0 bg-gradient-to-br from-white to-blue-50/30">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xl font-bold">Chat với AI Tư vấn</div>
              <div className="text-sm opacity-90">Hỗ trợ quản lý tài chính gia đình</div>
            </div>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshChat}
              disabled={isLoading}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={isLoading}
              className="text-white hover:bg-white/20"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"} group`}
                data-testid={`message-${msg.sender}-${msg.id}`}
              >
                {msg.sender === "ai" && (
                  <Avatar className="h-10 w-10 ring-2 ring-blue-100">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={`max-w-[75%] rounded-2xl p-4 shadow-sm transition-all duration-200 hover:shadow-md ${
                    msg.sender === "user"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-auto"
                      : "bg-white border border-gray-200 mr-auto"
                  }`}
                >
                  {msg.sender === "user" && user && (
                    <div className="text-xs opacity-80 mb-2 font-semibold flex items-center gap-1">
                      {user.role === 'father' ? '👨 Bố' : user.role === 'mother' ? '👩 Mẹ' : '👤 Thành viên'}
                      <span className="text-xs opacity-60">•</span>
                      <span className="text-xs opacity-60">
                        {msg.timestamp.toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  )}
                  
                  <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    <p className="word-break-all">{msg.text}</p>
                  </div>
                  
                  {msg.sender === "ai" && (
                    <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      <span>AI Assistant</span>
                      <span>•</span>
                      <span>
                        {msg.timestamp.toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {msg.sender === "user" && (
                  <Avatar className="h-10 w-10 ring-2 ring-blue-100">
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-600 text-white">
                      {user?.role === 'father' ? '👨' : user?.role === 'mother' ? '👩' : '👤'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-10 w-10 ring-2 ring-blue-100">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <Bot className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 max-w-[75%] mr-auto shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                    <span className="text-sm text-gray-600">AI đang suy nghĩ...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Quick Questions */}
        {messages.length === 0 && (
          <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Câu hỏi nhanh</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((question, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-blue-100 transition-colors text-xs px-3 py-1"
                  onClick={() => handleQuickQuestion(question)}
                >
                  {question}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t bg-gray-50/50">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Input
                placeholder="Hỏi AI về chi tiêu gia đình..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isTyping}
                className="pr-12 h-12 rounded-xl border-2 border-gray-200 focus:border-blue-500 transition-colors"
                data-testid="input-chat-message"
                maxLength={500}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                {message.length}/500
              </div>
            </div>
            {isTyping ? (
              <Button 
                onClick={handleStopChat}
                variant="destructive"
                className="h-12 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                data-testid="button-stop-chat"
              >
                <Square className="h-5 w-5 mr-2" />
                Dừng
              </Button>
            ) : (
              <Button 
                onClick={handleSend}
                disabled={!message.trim() || isStopped}
                className="h-12 w-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                data-testid="button-send-message"
              >
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-2 text-center">
            💡 Gợi ý: "Tôi nên tiết kiệm như thế nào?", "Phân tích chi tiêu tháng này"
          </div>
        </div>
      </CardContent>
    </Card>
  );
}