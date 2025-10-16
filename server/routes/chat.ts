import { Router, Request, Response } from "express";
import { db } from "../db";
import { chatSessions, chatMessages, users, expenses } from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { asyncHandler } from "../error-handler";
import { generateChatResponse } from "../gemini";
import { 
  getExpenseAnalytics, 
  getChatAnalytics, 
  getUserActivityPatterns,
  logChatActivity 
} from "../mongodb";

const router = Router();

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

// Create a new chat session
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

// Delete a chat session
router.delete("/sessions/:id", asyncHandler(async (req: Request, res: Response) => {
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
  const userSpendingStats = actualExpenses.reduce((acc, exp) => {
    const user = userMap.get(exp.userId);
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

  // Get AI response with real data
  let aiResponse: string;
  try {
    console.log('=== AI DEBUG START ===');
    console.log('Generating AI response with context length:', expenseContext.length);
    console.log('Expense data available:', actualExpenses.length, 'expenses');
    console.log('Family ID:', familyId);
    console.log('User ID:', userId);
    console.log('Message:', message.trim());
    console.log('Context preview (first 500 chars):', expenseContext.substring(0, 500));
    
    const aiPromise = generateChatResponse(message.trim(), expenseContext);
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('AI timeout')), 30000) // 30 second timeout
    );
    
    aiResponse = await Promise.race([aiPromise, timeoutPromise]);
    console.log('AI response generated successfully, length:', aiResponse.length);
    console.log('AI response preview (first 200 chars):', aiResponse.substring(0, 200));
    console.log('=== AI DEBUG END ===');
  } catch (error) {
    console.error('AI response error:', error);
    if (error instanceof Error && error.message === 'AI timeout') {
      aiResponse = "Xin lỗi, tôi đang xử lý dữ liệu quá nhiều. Vui lòng thử lại sau ít phút.";
    } else {
      aiResponse = "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau ít phút.";
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

