import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { categorizeExpense, generateChatResponse, generateFinancialInsights } from "./gemini";
import { 
  insertUserSchema, 
  insertExpenseSchema, 
  insertChatMessageSchema,
  type User 
} from "@shared/schema";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Middleware for JWT authentication
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(express.json());

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email đã được sử dụng" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, familyId: user.familyId },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: "Đăng ký thành công",
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          familyId: user.familyId
        }
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.issues) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: "Có lỗi xảy ra khi đăng ký" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email và mật khẩu là bắt buộc" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ error: "Email hoặc mật khẩu không đúng" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Email hoặc mật khẩu không đúng" });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, familyId: user.familyId },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: "Đăng nhập thành công",
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          familyId: user.familyId
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi đăng nhập" });
    }
  });

  // Expense routes
  app.post("/api/expenses", authenticateToken, async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse(req.body);
      const user = req.user;

      // Use AI to categorize expense if category not provided
      let category = validatedData.category;
      let aiConfidence = 0;
      
      if (!category) {
        const categorization = await categorizeExpense(validatedData.description);
        category = categorization.category;
        aiConfidence = categorization.confidence;
      }

      const expense = await storage.createExpense({
        ...validatedData,
        category,
        aiConfidence,
        userId: user.userId,
        familyId: user.familyId,
      });

      res.json({ message: "Thêm chi tiêu thành công", expense });
    } catch (error: any) {
      console.error('Create expense error:', error);
      if (error.issues) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: "Có lỗi xảy ra khi thêm chi tiêu" });
    }
  });

  app.get("/api/expenses", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const expenses = await storage.getExpenses(user.familyId, limit);
      res.json({ expenses });
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy danh sách chi tiêu" });
    }
  });

  // Stats routes
  app.get("/api/stats", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      const stats = await storage.getExpenseStats(user.familyId);
      
      // Generate AI insights
      const insights = await generateFinancialInsights(stats);
      
      res.json({ ...stats, insights });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy thống kê" });
    }
  });

  // Chat routes
  app.post("/api/chat", authenticateToken, async (req, res) => {
    try {
      const validatedData = insertChatMessageSchema.parse(req.body);
      const user = req.user;

      // Get recent expenses for context
      const recentExpenses = await storage.getExpenses(user.familyId, 20);
      const expenseContext = recentExpenses.map(exp => 
        `${exp.description}: ${exp.amount} VNĐ (${exp.category})`
      ).join('\n');

      // Generate AI response
      const aiResponse = await generateChatResponse(validatedData.message, expenseContext);

      // Save user message
      await storage.createChatMessage({
        ...validatedData,
        userId: user.userId,
        familyId: user.familyId,
        messageType: "user",
      });

      // Save AI response
      const responseMessage = await storage.createChatMessage({
        message: aiResponse,
        userId: user.userId,
        familyId: user.familyId,
        messageType: "ai",
      });

      res.json({ 
        message: "Tin nhắn đã được gửi",
        response: aiResponse,
        messageId: responseMessage.id
      });
    } catch (error: any) {
      console.error('Chat error:', error);
      if (error.issues) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: "Có lỗi xảy ra khi xử lý tin nhắn" });
    }
  });

  app.get("/api/chat/history", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const messages = await storage.getChatHistory(user.familyId, limit);
      res.json({ messages: messages.reverse() }); // Reverse to show oldest first
    } catch (error) {
      console.error('Get chat history error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy lịch sử chat" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
