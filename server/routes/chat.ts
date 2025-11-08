import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { chatSessions, chatMessages, users, expenses } from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { asyncHandler } from "../error-handler";
import { generateChatResponse } from "../gemini";
import { AIQueryEngine } from "../ai-queries";
import { 
  getExpenseAnalytics, 
  getChatAnalytics, 
  getUserActivityPatterns,
  logChatActivity 
} from "../mongodb";

const router = Router();

// Middleware để check nếu user là child (chỉ được xem và chat, không được xóa session)
function requireWritePermission(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Child chỉ có quyền xem và chat, không thể xóa session
  if (user.role === 'child') {
    return res.status(403).json({ error: 'Trẻ em chỉ có quyền xem và chat, không thể quản lý phiên chat' });
  }
  
  next();
}

// Get all chat sessions for a user
router.get("/sessions", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const sessions = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt));

  res.json({ sessions });
}));

// Create a new chat session (child có thể tạo để chat)
router.post("/sessions", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const familyId = req.user?.familyId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
  const { title } = req.body;
  
  const [session] = await db
    .insert(chatSessions)
    .values({
      userId,
      familyId,
      title: title || `Cuộc hội thoại ${new Date().toLocaleString('vi-VN')}`,
    })
    .returning();

    if (!session) {
      return res.status(500).json({ message: "Failed to create session" });
    }

  res.json({ session });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ message: "Failed to create session" });
  }
}));

// Delete a chat session (child không thể xóa)
router.delete("/sessions/:id", requireWritePermission, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const sessionId = req.params.id;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Verify session belongs to user before deletion
    const existingSession = await db
      .select()
      .from(chatSessions)
      .where(and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, userId)
      ))
      .limit(1);

    if (existingSession.length === 0) {
      return res.status(404).json({ message: "Session not found or unauthorized" });
  }

  // Delete all messages in the session first
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  
  // Delete the session
  await db
    .delete(chatSessions)
    .where(and(
      eq(chatSessions.id, sessionId),
      eq(chatSessions.userId, userId)
    ));

  res.json({ message: "Session deleted successfully" });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({ message: "Failed to delete session" });
  }
}));

// Get messages for a session
router.get("/sessions/:id/messages", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const sessionId = req.params.id;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const messages = await db
    .select({
      id: chatMessages.id,
      message: chatMessages.message,
      response: chatMessages.response,
      messageType: chatMessages.messageType,
      createdAt: chatMessages.createdAt,
      userId: chatMessages.userId,
      userName: users.fullName,
      userRole: users.role,
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.userId, users.id))
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);

  res.json({ messages });
}));

// Send a message in a session
router.post("/sessions/:id/messages", asyncHandler(async (req: Request, res: Response) => {
  console.log('=== CHAT MESSAGE DEBUG START ===');
  console.log('Request received for session:', req.params.id);
  console.log('User ID:', req.user?.id);
  console.log('Family ID:', req.user?.familyId);
  
  const userId = req.user?.id;
  const familyId = req.user?.familyId;
  const sessionId = req.params.id;
  
  if (!userId) {
    console.log('ERROR: No user ID found');
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { message } = req.body;
  console.log('Message received:', message);
  
  if (!message || message.trim().length === 0) {
    console.log('ERROR: Empty message');
    return res.status(400).json({ message: "Message cannot be empty" });
  }

  // Save user message
  const [userMessage] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      userId,
      familyId,
      message: message.trim(),
      messageType: "user",
    })
    .returning();

  // Get comprehensive expense data from PostgreSQL - ALL DATA
  console.log('Fetching expenses for familyId:', familyId);
  const actualExpenses = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      amount: expenses.amount,
      category: expenses.category,
      createdAt: expenses.createdAt,
      userId: expenses.userId,
      childId: expenses.childId, // Get childId to identify child expenses
      familyId: expenses.familyId,
    })
    .from(expenses)
    .where(eq(expenses.familyId, familyId!))
    .orderBy(desc(expenses.createdAt));
  
  console.log('Expenses fetched:', actualExpenses.length);
  console.log('First few expenses:', actualExpenses.slice(0, 3));

  // Get comprehensive user information for expenses
  const usersData = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      familyId: users.familyId,
    })
    .from(users)
    .where(eq(users.familyId, familyId!));

  // Get family member count
  const familyMemberCount = usersData.length;

  // Create user lookup map
  const userMap = new Map(usersData.map(user => [user.id, user]));

  // Get comprehensive expense statistics
  const totalExpenses = actualExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  const totalTransactions = actualExpenses.length;
  
  // Category statistics with counts
  const categoryStats = actualExpenses.reduce((acc, exp) => {
    if (exp.category) {
      if (!acc[exp.category]) {
        acc[exp.category] = { amount: 0, count: 0 };
      }
      acc[exp.category].amount += parseFloat(exp.amount);
      acc[exp.category].count += 1;
    }
    return acc;
  }, {} as Record<string, { amount: number; count: number }>);

  // User spending statistics
  // If expense has childId, it belongs to the child, not the user who created it
  const userSpendingStats = actualExpenses.reduce((acc, exp) => {
    // Use childId if set, otherwise use userId
    const targetUserId = (exp as any).childId || exp.userId;
    const user = userMap.get(targetUserId);
    const userName = user ? user.fullName : 'Unknown';
    if (!acc[userName]) {
      acc[userName] = { amount: 0, count: 0, role: user?.role || 'Unknown' };
    }
    acc[userName].amount += parseFloat(exp.amount);
    acc[userName].count += 1;
    return acc;
  }, {} as Record<string, { amount: number; count: number; role: string }>);

  // Get current month expenses
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthExpenses = actualExpenses.filter(exp => {
    if (!exp.createdAt) return false;
    const expDate = new Date(exp.createdAt);
    return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
  });
  const currentMonthTotal = currentMonthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

  // Format simplified expense data for AI context (reduced size)
  const expenseContext = actualExpenses.length > 0 
    ? `=== DỮ LIỆU CHI TIÊU GIA ĐÌNH ===
TỔNG QUAN:
- Tổng chi tiêu: ${totalExpenses.toLocaleString('vi-VN')} VNĐ
- Chi tiêu tháng này: ${currentMonthTotal.toLocaleString('vi-VN')} VNĐ
- Tổng số giao dịch: ${totalTransactions}
- Số thành viên gia đình: ${familyMemberCount}

THÀNH VIÊN GIA ĐÌNH:
${usersData.map(user => `${user.fullName} (${user.role})`).join(', ')}

CHI TIÊU THEO DANH MỤC (TOP 10):
${Object.entries(categoryStats)
  .sort(([,a], [,b]) => b.amount - a.amount)
  .slice(0, 10)
  .map(([category, stats]) => `${category}: ${stats.amount.toLocaleString('vi-VN')} VNĐ (${stats.count} giao dịch)`)
  .join('\n')}

CHI TIÊU THEO THÀNH VIÊN:
${Object.entries(userSpendingStats)
  .sort(([,a], [,b]) => b.amount - a.amount)
  .map(([name, stats]) => `${name} (${stats.role}): ${stats.amount.toLocaleString('vi-VN')} VNĐ`)
  .join('\n')}

GIAO DỊCH GẦN NHẤT (10 giao dịch):
${actualExpenses.slice(0, 10).map(exp => {
  const user = userMap.get(exp.userId);
  const userName = user ? user.fullName : 'Unknown';
  const createdAt = exp.createdAt ? new Date(exp.createdAt).toLocaleDateString('vi-VN') : 'N/A';
  return `${exp.description} | ${parseFloat(exp.amount).toLocaleString('vi-VN')} VNĐ | ${exp.category} | ${userName} | ${createdAt}`;
}).join('\n')}`
    : `Chưa có dữ liệu chi tiêu để phân tích.`;

  // Get conversation history for context
  const conversationHistory = await db
    .select({
      message: chatMessages.message,
      response: chatMessages.response,
      messageType: chatMessages.messageType,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt)
    .limit(20); // Get last 20 messages for context

  console.log('Conversation history loaded:', conversationHistory.length, 'messages');

  // Get AI response with real data and conversation history
  let aiResponse: string;
  try {
    console.log('=== AI DEBUG START ===');
    console.log('Generating AI response with context length:', expenseContext.length);
    console.log('Expense data available:', actualExpenses.length, 'expenses');
    console.log('Family ID:', familyId);
    console.log('User ID:', userId);
    console.log('Message:', message.trim());
    console.log('Conversation history:', conversationHistory.length, 'messages');
    console.log('Context preview (first 500 chars):', expenseContext.substring(0, 500));
    
    // Log top 5 largest expenses for debugging
    const topExpenses = actualExpenses
      .sort((a: any, b: any) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 5)
      .map((exp: any) => ({
        description: exp.description,
        amount: parseFloat(exp.amount),
        amountInMillion: (parseFloat(exp.amount) / 1000000).toFixed(2)
      }));
    console.log('🔍 Top 5 largest expenses in database:', topExpenses);
    
    // ==================== SMART AI ENHANCEMENT ====================
    // Phân tích câu hỏi và truy vấn dữ liệu thực tế từ database
    const messageLower = message.trim().toLowerCase();
    let enhancedContext = expenseContext;
    const queryEngine = new AIQueryEngine(familyId!);
    
    // 1. Tổng quan / Phân tích chung
    if (messageLower.includes('tổng quan') || messageLower.includes('phân tích') || 
        messageLower.includes('thống kê') || messageLower.includes('tình hình')) {
      const smartAnalysis = await queryEngine.getSmartAnalysis();
      if (smartAnalysis.success) {
        enhancedContext += `\n\n📊 PHÂN TÍCH TỔNG QUAN:\n${smartAnalysis.message}`;
      }
    }
    
    // 2. Khoản chi tiêu lớn nhất - LUÔN gọi để có dữ liệu chính xác nhất
    if (messageLower.includes('lớn nhất') || messageLower.includes('cao nhất') || messageLower.includes('nhiều nhất') ||
        messageLower.includes('chi tiêu lớn') || messageLower.includes('khoản lớn')) {
      console.log('🔍 Detected largest expense query, fetching from database...');
      const largestResult = await queryEngine.getLargestExpense();
      console.log('🔍 Largest expense query result:', {
        success: largestResult.success,
        message: largestResult.message?.substring(0, 200),
        data: largestResult.data
      });
      if (largestResult.success) {
        enhancedContext += `\n\n${largestResult.message}`;
        console.log('✅ Added largest expense data to enhanced context');
      } else {
        console.log('⚠️ Failed to get largest expense from database');
      }
      
      // Thêm danh sách các khoản lớn
      if (messageLower.includes('danh sách') || messageLower.includes('top')) {
        const largeExpenses = await queryEngine.getLargeExpenses(1000000);
        if (largeExpenses.success) {
          enhancedContext += `\n\n📋 DANH SÁCH CÁC KHOẢN LỚN:\n${largeExpenses.message}`;
        }
      }
    }
    
    // 3. Đám cưới
    if (messageLower.includes('đám cưới') || messageLower.includes('cưới') || messageLower.includes('mừng cưới')) {
      const weddingResult = await queryEngine.getExpensesByCategoryAndTime('Đám cưới');
      if (weddingResult.success) {
        enhancedContext += `\n\n💒 CHI TIÊU ĐÁM CƯỚI:\n${weddingResult.message}`;
      }
    }
    
    // 4. Thống kê tháng này
    if (messageLower.includes('tháng này') || messageLower.includes('tháng hiện tại') || messageLower.includes('tháng nay')) {
      const monthlyResult = await queryEngine.getMonthlyStats();
      if (monthlyResult.success) {
        enhancedContext += `\n\n📅 THỐNG KÊ THÁNG NÀY:\n${monthlyResult.message}`;
      }
      
      // So sánh với tháng trước
      if (messageLower.includes('so sánh') || messageLower.includes('tháng trước')) {
        const comparison = await queryEngine.compareCurrentVsPreviousMonth();
        if (comparison.success) {
          enhancedContext += `\n\n📊 SO SÁNH VỚI THÁNG TRƯỚC:\n${comparison.message}`;
        }
      }
    }
    
    // 5. Theo thành viên
    if (messageLower.includes('thành viên') || messageLower.includes('con') || 
        messageLower.includes('bố') || messageLower.includes('mẹ') ||
        messageLower.includes('tuấn') || messageLower.includes('chi')) {
      const memberStats = await queryEngine.getExpensesByMember();
      if (memberStats.success) {
        enhancedContext += `\n\n👨‍👩‍👧‍👦 CHI TIÊU THEO THÀNH VIÊN:\n${memberStats.message}`;
      }
    }
    
    // 6. Danh mục cụ thể
    const categories = ['ăn uống', 'học tập', 'y tế', 'giải trí', 'giao thông', 'quần áo', 'gia dụng', 'đám ma'];
    for (const cat of categories) {
      if (messageLower.includes(cat)) {
        const categoryName = cat.charAt(0).toUpperCase() + cat.slice(1);
        const catResult = await queryEngine.getExpensesByCategoryAndTime(categoryName);
        if (catResult.success) {
          enhancedContext += `\n\n🏷️ CHI TIÊU ${categoryName.toUpperCase()}:\n${catResult.message}`;
        }
      }
    }
    
    // 7. Tiết kiệm
    if (messageLower.includes('tiết kiệm') || messageLower.includes('giảm chi')) {
      const largeExpenses = await queryEngine.getLargeExpenses(500000);
      if (largeExpenses.success) {
        enhancedContext += `\n\n💡 CƠ HỘI TIẾT KIỆM (các khoản >= 500K):\n${largeExpenses.message}`;
      }
      
      // Nếu có số tiền cụ thể (ví dụ: tiết kiệm 10tr, 10 triệu)
      const savingsMatch = messageLower.match(/tiết kiệm\s*(\d+)\s*(tr|triệu|triệu đồng|vnđ|vnd)/);
      if (savingsMatch) {
        const amount = parseInt(savingsMatch[1]) * 1000000; // Convert to VNĐ
        const savingsPlan = await queryEngine.getSavingsPlan(amount);
        if (savingsPlan.success) {
          enhancedContext += `\n\n${savingsPlan.message}`;
        }
      }
    }
    
    // 8. Tối ưu chi tiêu
    if (messageLower.includes('tối ưu') || messageLower.includes('làm sao để') || 
        messageLower.includes('cách tối ưu') || messageLower.includes('tối ưu hóa')) {
      const optimization = await queryEngine.getOptimizationSuggestions();
      if (optimization.success) {
        enhancedContext += `\n\n${optimization.message}`;
      }
    }
    
    // 9. Chi tiêu tháng trước
    if (messageLower.includes('tháng trước') || messageLower.includes('tháng vừa rồi') ||
        messageLower.includes('bạn thấy chi tiêu tháng trước') || messageLower.includes('chi tiêu tháng trước thế nào')) {
      const prevMonthAnalysis = await queryEngine.getPreviousMonthAnalysis();
      if (prevMonthAnalysis.success) {
        enhancedContext += `\n\n${prevMonthAnalysis.message}`;
      }
    }
    
    // Format conversation history for AI context
    const historyContext = conversationHistory
      .slice(0, -1) // Exclude current message (it's being processed)
      .map((msg) => {
        if (msg.messageType === 'user') {
          return `Người dùng: ${msg.message}`;
        } else {
          return `AI: ${msg.response || msg.message}`;
        }
      })
      .join('\n\n');
    
    // Log enhanced context to verify data is included
    console.log('📊 Enhanced context length:', enhancedContext.length);
    console.log('📊 Enhanced context includes largest expense:', enhancedContext.includes('KHOẢN CHI TIÊU LỚN NHẤT'));
    if (enhancedContext.includes('KHOẢN CHI TIÊU LỚN NHẤT')) {
      const largestSection = enhancedContext.match(/💰 KHOẢN CHI TIÊU LỚN NHẤT[^💰]*/);
      if (largestSection) {
        console.log('📊 Largest expense section:', largestSection[0].substring(0, 300));
      }
    }
    
    const aiPromise = generateChatResponse(
      message.trim(), 
      enhancedContext, // Pass enhanced context with database queries
      familyId,
      historyContext // Pass conversation history
    );
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('AI timeout')), 30000) // 30 second timeout
    );
    
    aiResponse = await Promise.race([aiPromise, timeoutPromise]);
    console.log('AI response generated successfully, length:', aiResponse.length);
    console.log('AI response preview (first 200 chars):', aiResponse.substring(0, 200));
    console.log('=== AI DEBUG END ===');
  } catch (error) {
    console.error('AI response error:', error);
    // Use smart fallback instead of generic error message
    if (error instanceof Error && error.message === 'AI timeout') {
      console.log('⏱️ AI timeout, using smart fallback...');
      // Generate smart fallback with enhanced context
      const { generateSmartFallbackResponse } = await import('../gemini');
      aiResponse = generateSmartFallbackResponse(message.trim(), expenseContext, familyId);
    } else {
      console.log('❌ AI error, using smart fallback...');
      // Generate smart fallback with enhanced context
      const { generateSmartFallbackResponse } = await import('../gemini');
      aiResponse = generateSmartFallbackResponse(message.trim(), expenseContext, familyId);
    }
  }

  // Save AI response
  const [aiMessage] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      userId,
      familyId,
      message: aiResponse,
      messageType: "ai",
    })
    .returning();

  // Update session's updatedAt
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));

  res.json({ 
    userMessage,
    aiMessage,
    response: aiResponse 
  });
}));

export default router;

