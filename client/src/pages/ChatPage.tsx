import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { MessageCircle, Plus, Trash2, Send, Bot, User, Menu, X } from "lucide-react";
import { apiService } from "@/lib/api";

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  message: string;
  messageType: 'user' | 'ai';
  createdAt: string;
  userName?: string;
  userRole?: string;
}

export default function ChatPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [typingMessage, setTypingMessage] = useState("");
  const [isTypingMessage, setIsTypingMessage] = useState(false);

  // Fetch sessions with aggressive refresh
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const response = await apiService.request('GET', '/api/chat/sessions');
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  // Fetch messages for selected session with aggressive refresh
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', selectedSession],
    queryFn: async () => {
      if (!selectedSession) return { messages: [] };
      const response = await apiService.request('GET', `/api/chat/sessions/${selectedSession}/messages`);
      return response.json();
    },
    enabled: !!selectedSession,
    staleTime: 10 * 1000, // 10 seconds - very aggressive for chat
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiService.request('POST', '/api/chat/sessions', {
        title: `Cuộc hội thoại ${new Date().toLocaleString('vi-VN')}`,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data?.session?.id) {
        queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        setSelectedSession(data.session.id);
        toast({
          title: "Tạo cuộc hội thoại mới",
          description: "Đã tạo cuộc hội thoại mới thành công",
        });
      } else {
        throw new Error("Invalid session data received");
      }
    },
    onError: (error) => {
      console.error('Error creating session:', error);
      toast({
        title: "Lỗi tạo cuộc hội thoại",
        description: "Không thể tạo cuộc hội thoại mới. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiService.request('DELETE', `/api/chat/sessions/${sessionId}`);
    },
    onSuccess: (_, sessionId) => {
      // Only invalidate specific queries, not all
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] });
      
      // Only clear selected session if it's the one being deleted
      if (selectedSession === sessionId) {
        setSelectedSession(null);
      }
      
      toast({
        title: "Đã xóa cuộc hội thoại",
        description: "Cuộc hội thoại đã được xóa thành công",
      });
    },
    onError: (error) => {
      console.error('Error deleting session:', error);
      toast({
        title: "Lỗi xóa cuộc hội thoại",
        description: "Không thể xóa cuộc hội thoại. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (msg: string) => {
      if (!selectedSession) throw new Error("No session selected");
      const response = await apiService.request('POST', `/api/chat/sessions/${selectedSession}/messages`, {
        message: msg,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Use typing effect for AI response
      if (data?.response) {
        // Add AI message to local state with typing effect
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          message: '', // Start with empty message
          messageType: 'ai',
          createdAt: new Date().toISOString(),
        };
        
        // Add empty AI message first
        setMessages((prev) => [...prev, aiMessage]);
        
        // Start typing effect
        typeMessage(data.response, () => {
          // Update the AI message with full text after typing
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === aiMessage.id 
                ? { ...msg, message: data.response }
                : msg
            )
          );
          
          // Only invalidate queries after typing is complete
          queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedSession] });
        });
      } else {
        // No AI response, just invalidate queries
        queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedSession] });
      }
      setMessage("");
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      toast({
        title: "Lỗi",
        description: "Không thể gửi tin nhắn. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Typing effect function
  const typeMessage = (text: string, callback: () => void) => {
    setIsTypingMessage(true);
    setTypingMessage("");
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setTypingMessage(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
        setIsTypingMessage(false);
        callback();
      }
    }, 30); // 30ms per character for more visible typing effect
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    
    const userMessage = message.trim();
    setMessage(""); // Clear input immediately
    
    // Add user message to UI immediately (optimistic update)
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      message: userMessage,
      messageType: 'user',
      createdAt: new Date().toISOString(),
      userName: user?.fullName,
      userRole: user?.role,
    };
    
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsTyping(true);
    
    // If no session selected, create one first
    if (!selectedSession) {
      try {
        const newSession = await createSessionMutation.mutateAsync();
        if (newSession?.session?.id) {
          setSelectedSession(newSession.session.id);
          // Send message with new session
          sendMessageMutation.mutate(userMessage);
        }
      } catch (error) {
        setIsTyping(false);
        // Remove temp message on error
        setMessages((prev) => prev.filter(m => m.id !== tempUserMsg.id));
        setMessage(userMessage); // Restore message
      }
      return;
    }
    
    sendMessageMutation.mutate(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Sync messages from API with local state - PERSIST ACROSS TAB SWITCHES
  useEffect(() => {
    if (messagesData?.messages && selectedSession) {
      setMessages(messagesData.messages);
    }
  }, [messagesData, selectedSession]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-create first session if none exists, or select first session
  useEffect(() => {
    if (sessionsData?.sessions) {
      if (sessionsData.sessions.length === 0 && !createSessionMutation.isPending) {
        // No sessions exist, create one automatically
        createSessionMutation.mutate();
      } else if (sessionsData.sessions.length > 0 && !selectedSession) {
        // Sessions exist but none selected, select first one
        setSelectedSession(sessionsData.sessions[0].id);
      }
    }
  }, [sessionsData, selectedSession]);

  // DON'T clear messages when session changes - keep them persistent
  // This prevents losing chat history when switching tabs

  const sessions: ChatSession[] = sessionsData?.sessions || [];

  return (
    <div className="space-y-6">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          className="hover:bg-blue-100"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Chat AI
        </h2>
        <div className="w-10" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] lg:h-[calc(100vh-120px)]">

        {/* Sidebar - Sessions List */}
        <Card className={`w-full lg:w-80 flex-shrink-0 flex flex-col overflow-hidden transition-transform duration-300 ${
          showMobileSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } lg:block ${showMobileSidebar ? 'fixed inset-y-0 left-0 z-50 bg-white shadow-2xl' : ''}`}>
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardTitle className="flex items-center justify-between">
            <span>Cuộc hội thoại</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => createSessionMutation.mutate()}
                disabled={createSessionMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="lg:hidden"
                onClick={() => setShowMobileSidebar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            {sessionsLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Đang tải...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Chưa có cuộc hội thoại nào
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedSession === session.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedSession(session.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">
                          {session.title}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(session.updatedAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSessionMutation.mutate(session.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col shadow-xl border-0 bg-gradient-to-br from-white to-blue-50/30 overflow-hidden min-h-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white flex-shrink-0">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg animate-pulse">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-bold">Chat với AI Tư vấn</div>
                <div className="text-sm opacity-90">Hỗ trợ quản lý tài chính gia đình</div>
              </div>
            </CardTitle>
          </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
          {sessionsLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50 animate-pulse" />
                <p>Đang tải...</p>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 p-4">
                  {messagesLoading ? (
                    <div className="text-center text-muted-foreground">
                      Đang tải tin nhắn...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                      Bắt đầu cuộc hội thoại mới
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          msg.messageType === 'user' ? 'justify-end' : 'justify-start'
                        } group`}
                      >
                        {msg.messageType === 'ai' && (
                          <Avatar className="h-10 w-10 ring-2 ring-blue-100">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              <Bot className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                        )}

                         <div
                           className={`max-w-[70%] rounded-2xl p-4 shadow-lg transition-all duration-500 hover:shadow-xl transform hover:scale-[1.02] ${
                             msg.messageType === 'user'
                               ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-auto hover:from-blue-600 hover:to-blue-700 animate-slideInRight'
                               : 'bg-gradient-to-br from-white to-blue-50 border border-gray-200 mr-auto hover:border-blue-300 animate-slideInLeft'
                           }`}
                         >
                          {msg.messageType === 'user' && msg.userName && (
                            <div className="text-xs opacity-90 mb-2 font-semibold flex items-center gap-1">
                              {msg.userRole === 'father' ? '👨 Bố' : msg.userRole === 'mother' ? '👩 Mẹ' : '👤 Thành viên'}
                              <span className="text-xs opacity-70">•</span>
                              <span className="text-xs opacity-70">
                                {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}

                          <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
                          {msg.messageType === 'ai' && isTypingMessage && msg.id === messages[messages.length - 1]?.id ? (
                            typingMessage.split('\n').map((line, i) => (
                              <p key={i} className="mb-2 last:mb-0">
                                {line || '\u00A0'}
                                {i === typingMessage.split('\n').length - 1 && (
                                  <span className="inline-block w-0.5 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                                )}
                              </p>
                            ))
                          ) : (
                              msg.message.split('\n').map((line, i) => (
                                <p key={i} className="mb-2 last:mb-0">{line || '\u00A0'}</p>
                              ))
                            )}
                          </div>

                          {msg.messageType === 'ai' && (
                            <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100 flex items-center gap-1">
                              <Bot className="h-3 w-3" />
                              <span className="font-medium">AI Assistant</span>
                              <span>•</span>
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
      </div>

                        {msg.messageType === 'user' && (
                          <Avatar className="h-10 w-10 ring-2 ring-blue-100">
                            <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-600 text-white">
                              {msg.userRole === 'father' ? '👨' : msg.userRole === 'mother' ? '👩' : '👤'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))
                  )}

                  {isTyping && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="h-10 w-10 ring-2 ring-blue-100">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-gradient-to-br from-white to-blue-50 border border-gray-200 rounded-2xl p-4 max-w-[75%] mr-auto shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
                          {isTypingMessage ? (
                            typingMessage.split('\n').map((line, i) => (
                              <p key={i} className="mb-2 last:mb-0">
                                {line || '\u00A0'}
                                {i === typingMessage.split('\n').length - 1 && (
                                  <span className="inline-block w-0.5 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                                )}
                              </p>
                            ))
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                <div
                                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                  style={{ animationDelay: '0.1s' }}
                                ></div>
                                <div
                                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                  style={{ animationDelay: '0.2s' }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600">AI đang suy nghĩ...</span>
                            </div>
                          )}
                        </div>
                        {isTypingMessage && (
                          <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100 flex items-center gap-1">
                            <Bot className="h-3 w-3" />
                            <span className="font-medium">AI Assistant</span>
                            <span>•</span>
                            <span>
                              {new Date().toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

               <div className="p-4 border-t bg-gradient-to-r from-gray-50/50 to-blue-50/30 flex-shrink-0">
                 <div className="flex gap-3 items-end">
                   <div className="flex-1 relative">
                     <Input
                       placeholder="Hỏi AI về chi tiêu gia đình..."
                       value={message}
                       onChange={(e) => setMessage(e.target.value)}
                       onKeyPress={handleKeyPress}
                       disabled={isTyping}
                       className="pr-12 h-12 rounded-xl border-2 border-gray-200 focus:border-blue-500 transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg"
                     />
                     <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                       {message.length}/500
                     </div>
                   </div>
                   <Button
                     onClick={handleSend}
                     disabled={!message.trim() || isTyping}
                     className="h-12 w-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     <Send className="h-5 w-5" />
                   </Button>
                 </div>
                 <div className="mt-4">
                   <p className="text-sm text-gray-600 mb-3 font-medium">💡 Gợi ý tin nhắn nhanh:</p>
                   <div className="grid grid-cols-2 gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setMessage("Phân tích chi tiêu tháng này")}
                       className="text-xs h-8 rounded-lg border-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all duration-300 hover:shadow-md px-3 text-left"
                     >
                       📊 Phân tích chi tiêu
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setMessage("Làm sao để quản lý ngân sách gia đình?")}
                       className="text-xs h-8 rounded-lg border-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all duration-300 hover:shadow-md px-3 text-left"
                     >
                       🏠 Quản lý ngân sách
                     </Button>
                   </div>
                 </div>
               </div>
            </>
          )}
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }
