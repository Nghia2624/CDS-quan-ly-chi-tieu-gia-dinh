import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { categorizeExpense, generateChatResponse, generateFinancialInsights } from "./gemini";
import { syncManager } from "./sync-manager";
import importRoutes from "./routes/import";
import chatRoutes from "./routes/chat";
import analysisRoutes from "./routes/analysis";
import savingsGoalsRoutes from "./routes/savings-goals";
import alertsRoutes from "./routes/alerts";
import { 
  apiLimiter, 
  authLimiter, 
  chatLimiter, 
  syncLimiter,
  corsMiddleware, 
  requestLogger, 
  securityHeaders 
} from "./middleware";
import { errorHandler, asyncHandler, notFound } from "./error-handler";
import {
  sanitizeInput,
  securityLogger,
  validateInput,
  expenseSchema,
  userSchema,
  chatSchema,
  createRateLimit
} from "./security";
import {     
  insertUserSchema, 
  insertExpenseSchema, 
  insertChatMessageSchema,
  type User 
} from "@shared/schema";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";

// @ts-ignore
import envConfig from '../env.config.js';

const JWT_SECRET = envConfig.JWT_SECRET;

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        email: string;
        familyId: string;
        role?: string;
        fullName?: string;
      };
    }
  }
}

// Middleware for JWT authentication
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Try to get user from database for latest role, but fallback to token if fails
    try {
      const user = await storage.getUser(decoded.userId);
      if (user) {
        req.user = {
          id: user.id,
          userId: user.id,
          email: user.email,
          familyId: user.familyId || decoded.familyId,
          role: user.role || decoded.role,
          fullName: user.fullName || decoded.fullName,
        };
      } else {
        // Fallback to token data
        req.user = {
          ...decoded,
          id: decoded.userId,
          userId: decoded.userId,
        };
      }
    } catch (error) {
      // Fallback to token data if database query fails
      req.user = {
        ...decoded,
        id: decoded.userId,
        userId: decoded.userId,
      };
    }
    
    next();
  });
}

// Role-based access control middleware
function requireRole(allowedRoles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Lấy role từ database (cần fetch user để lấy role)
    // Tạm thời cho phép tất cả authenticated users, sẽ update sau khi có role trong JWT
    // Nếu role trong JWT thì check luôn
    if (user.role && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Middleware để check nếu user là child (chỉ được xem, không được sửa)
function requireWritePermission(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Child chỉ có quyền xem
  if (user.role === 'child') {
    return res.status(403).json({ error: 'Trẻ em chỉ có quyền xem, không thể thêm hoặc sửa dữ liệu' });
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply middleware
  app.use(corsMiddleware);
  app.use(securityHeaders);
  app.use(securityLogger);
  app.use(sanitizeInput);
  app.use(requestLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  // Apply rate limiting
  app.use("/api", apiLimiter);
  
  // Import routes
  app.use("/api", importRoutes);
  
  // Chat routes with authentication
  app.use("/api/chat", authenticateToken, chatRoutes);
  
  // Analysis routes with authentication
  app.use("/api/analysis", authenticateToken, analysisRoutes);
  
  // Savings Goals routes with authentication
  app.use("/api/savings-goals", authenticateToken, savingsGoalsRoutes);

  // Alerts and reminders routes
  app.use("/api/alerts", authenticateToken, alertsRoutes);

  // Auth routes with rate limiting
  app.post("/api/auth/register", authLimiter, validateInput(userSchema), asyncHandler(async (req: any, res: any) => {
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

      // Generate JWT token with role
      const token = jwt.sign(
        { userId: user.id, email: user.email, familyId: user.familyId, role: user.role, fullName: user.fullName },
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
  }));

  app.post("/api/auth/login", authLimiter, validateInput(z.object({ email: z.string().email(), password: z.string().min(1) })), asyncHandler(async (req: any, res: any) => {
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
        { userId: user.id, email: user.email, familyId: user.familyId, role: user.role, fullName: user.fullName },
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
  }));

  // Family routes
  app.get("/api/family/members", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "User not authenticated" });
      
      const members = await storage.getFamilyMembers(user.familyId);
      
      // Add sync information for better data consistency
      const enrichedMembers = members.map(member => ({
        ...member,
        familyId: user.familyId,
        lastSync: new Date().toISOString(),
        dataVersion: 1
      }));
      
      res.json({ 
        members: enrichedMembers,
        familyId: user.familyId,
        totalCount: members.length,
        lastSync: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get family members error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy thành viên gia đình" });
    }
  });

  app.post("/api/family/invite", authenticateToken, requireWritePermission, async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "User not authenticated" });
      const { email, fullName, role } = req.body || {};
      if (!email || !fullName || !role) {
        return res.status(400).json({ error: "Thiếu thông tin thành viên" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        // link existing user to family
        const updated = await storage.linkUserToFamily(existing.id, user.familyId);
        return res.json({ message: "Đã liên kết thành viên vào gia đình", userId: updated.id });
      }
      // Create new user with temp password and same familyId
      const tempPassword = await bcrypt.hash(Math.random().toString(36).slice(2, 10), 10);
      const created = await storage.createUser({ email, fullName, role, password: tempPassword, phone: "" } as any);
      await storage.linkUserToFamily(created.id, user.familyId);
      res.json({ message: "Mời thành viên thành công", userId: created.id });
    } catch (error) {
      console.error('Invite member error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi mời thành viên" });
    }
  });

  app.put("/api/family/members/:id", authenticateToken, requireWritePermission, async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "User not authenticated" });
      
      const { id } = req.params;
      const { email, fullName, role } = req.body || {};
      
      if (!email || !fullName || !role) {
        return res.status(400).json({ error: "Thiếu thông tin cập nhật" });
      }

      // Check if member belongs to the same family
      const member = await storage.getUserById(id);
      if (!member || member.familyId !== user.familyId) {
        return res.status(404).json({ error: "Không tìm thấy thành viên" });
      }

      // Update member
      const updated = await storage.updateUser(id, { email, fullName, role });
      res.json({ message: "Cập nhật thành viên thành công", member: updated });
    } catch (error) {
      console.error('Update member error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi cập nhật thành viên" });
    }
  });

  app.delete("/api/family/members/:id", authenticateToken, requireWritePermission, async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "User not authenticated" });
      
      const { id } = req.params;

      // Check if member belongs to the same family
      const member = await storage.getUserById(id);
      if (!member || member.familyId !== user.familyId) {
        return res.status(404).json({ error: "Không tìm thấy thành viên" });
      }

      // Don't allow deleting yourself
      if (member.id === user.id) {
        return res.status(400).json({ error: "Không thể xóa chính mình" });
      }

      // Delete member
      await storage.deleteUser(id);
      res.json({ message: "Xóa thành viên thành công" });
    } catch (error) {
      console.error('Delete member error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi xóa thành viên" });
    }
  });

  // Expense routes
  app.post("/api/expenses", authenticateToken, requireWritePermission, validateInput(expenseSchema), async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse(req.body);
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

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

  // AI categorization endpoint
  app.post("/api/expenses/categorize", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { description, amount } = req.body;
      if (!description || !amount) {
        return res.status(400).json({ error: "Thiếu mô tả hoặc số tiền" });
      }

      const categorization = await categorizeExpense(description);
      res.json({
        category: categorization.category,
        confidence: categorization.confidence
      });
    } catch (error: any) {
      console.error('Categorize expense error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi phân loại chi tiêu" });
    }
  });

  app.get("/api/expenses", authenticateToken, async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 1000; // Increase default for filtering
      const { 
        startDate, 
        endDate, 
        category, 
        search,
        userId,
        minAmount,
        maxAmount,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      
      let expenses = await storage.getExpenses(user.familyId, limit);
      
      // Apply filters
      if (startDate || endDate || category || search || userId || minAmount || maxAmount) {
        expenses = expenses.filter((exp) => {
          // Date filter
          if (startDate || endDate) {
            const expDate = exp.createdAt ? new Date(exp.createdAt) : null;
            if (!expDate) return false;
            if (startDate && expDate < new Date(startDate as string)) return false;
            if (endDate && expDate > new Date(endDate as string)) return false;
          }
          
          // Category filter
          if (category && exp.category !== category) return false;
          
          // Search filter (description)
          if (search) {
            const searchLower = (search as string).toLowerCase();
            if (!exp.description.toLowerCase().includes(searchLower)) return false;
          }
          
          // User filter - check both userId (creator) and childId (owner)
          if (userId) {
            const matchesUserId = exp.userId === userId;
            const matchesChildId = (exp as any).childId === userId;
            if (!matchesUserId && !matchesChildId) return false;
          }
          
          // Amount filter
          const amount = parseFloat(exp.amount || '0');
          if (minAmount && amount < parseFloat(minAmount as string)) return false;
          if (maxAmount && amount > parseFloat(maxAmount as string)) return false;
          
          return true;
        });
      }
      
      // Sort
      expenses.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortBy) {
          case 'amount':
            aValue = parseFloat(a.amount || '0');
            bValue = parseFloat(b.amount || '0');
            break;
          case 'description':
            aValue = a.description.toLowerCase();
            bValue = b.description.toLowerCase();
            break;
          case 'category':
            aValue = (a.category || '').toLowerCase();
            bValue = (b.category || '').toLowerCase();
            break;
          case 'createdAt':
          default:
            aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            break;
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
      
      // Add user information to each expense for better data sync
      const enrichedExpenses = expenses.map(expense => ({
        ...expense,
        familyId: user.familyId,
        syncedAt: new Date().toISOString(),
        dataVersion: 1
      }));
      
      res.json({ 
        expenses: enrichedExpenses,
        familyId: user.familyId,
        totalCount: enrichedExpenses.length,
        filteredCount: enrichedExpenses.length,
        lastSync: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy danh sách chi tiêu" });
    }
  });

  // Stats routes
  app.get("/api/stats", authenticateToken, async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Optional date range and category filter
      const { from, to, category } = req.query as any;
      const stats = await storage.getExpenseStats(user.familyId);
      // basic in-memory filter for demo; for production, push to SQL
      const filtered = { ...stats } as any;
      if (from || to || category) {
        const expenses = await storage.getExpenses(user.familyId, 1000);
        const filteredExpenses = expenses.filter((e) => {
          const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
          const okFrom = from ? t >= new Date(from).getTime() : true;
          const okTo = to ? t <= new Date(to).getTime() : true;
          const okCat = category ? e.category === String(category) : true;
          return okFrom && okTo && okCat;
        });
        const amounts = filteredExpenses.map((e) => parseFloat(e.amount));
        filtered.totalAmount = amounts.reduce((a, b) => a + b, 0);
      }
      
      // Generate AI insights
      let insights = "Đang phân tích dữ liệu tài chính...";
      try {
        if (filtered.expenses && filtered.expenses.length > 0) {
          insights = await generateFinancialInsights(filtered);
        } else {
          insights = "Chưa có dữ liệu chi tiêu để phân tích. Hãy thêm một số chi tiêu để AI có thể đưa ra gợi ý thông minh.";
        }
      } catch (error: any) {
        console.warn('AI insights generation failed:', error);
        if (error?.message && error.message.includes('quota')) {
          insights = "AI đang tạm thời quá tải. Vui lòng thử lại sau ít phút.";
        } else {
          insights = "Có lỗi xảy ra khi phân tích dữ liệu tài chính. Vui lòng thử lại sau.";
        }
      }
      
      // Add sync information
      const enrichedStats = {
        ...filtered,
        insights,
        familyId: user.familyId,
        lastSync: new Date().toISOString(),
        dataVersion: 1,
        syncStatus: 'up_to_date'
      };
      
      res.json(enrichedStats);
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy thống kê" });
    }
  });

  // Chat routes are now handled by chatRoutes in /api/chat

  // Sync routes
  app.get("/api/sync/status", syncLimiter, authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const status = await syncManager.getSyncStatus(user.familyId);
      res.json(status);
    } catch (error) {
      console.error('Get sync status error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy trạng thái đồng bộ" });
    }
  });

  app.get("/api/sync/changes", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const since = req.query.since as string;
      const changes = await syncManager.getChanges(user.familyId, since);
      res.json(changes);
    } catch (error) {
      console.error('Get sync changes error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy thay đổi đồng bộ" });
    }
  });

  app.post("/api/sync/force", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const result = await syncManager.forceSync(user.familyId);
      res.json(result);
    } catch (error) {
      console.error('Force sync error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi đồng bộ dữ liệu" });
    }
  });

  app.get("/api/sync/stats", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const stats = await syncManager.getSyncStats(user.familyId);
      res.json(stats);
    } catch (error) {
      console.error('Get sync stats error:', error);
      res.status(500).json({ error: "Có lỗi xảy ra khi lấy thống kê đồng bộ" });
    }
  });

  // User profile update route
  app.put('/api/users/profile', authenticateToken, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { fullName, email, monthlyBudget } = req.body;
      
      const updatedUser = await storage.updateUser(userId, {
        fullName,
        email,
        monthlyBudget
      });
      
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  });

  // AI Dashboard endpoints
  app.get('/api/ai/smart-analysis', authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "User not authenticated" });

      const { AIQueryEngine } = await import('./ai-queries');
      const queryEngine = new AIQueryEngine(user.familyId);
      const result = await queryEngine.getSmartAnalysis();
      
      res.json(result);
    } catch (error) {
      console.error('AI smart analysis error:', error);
      res.status(500).json({ success: false, message: 'Failed to get AI analysis' });
    }
  });

  app.get('/api/ai/largest-expense', authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "User not authenticated" });

      const { AIQueryEngine } = await import('./ai-queries');
      const queryEngine = new AIQueryEngine(user.familyId);
      const result = await queryEngine.getLargestExpense();
      
      res.json(result);
    } catch (error) {
      console.error('AI largest expense error:', error);
      res.status(500).json({ success: false, message: 'Failed to get largest expense' });
    }
  });

  app.get('/api/ai/monthly-stats', authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "User not authenticated" });

      const { month, year } = req.query;
      const { AIQueryEngine } = await import('./ai-queries');
      const queryEngine = new AIQueryEngine(user.familyId);
      const result = await queryEngine.getMonthlyStats(
        month ? parseInt(month as string) : undefined,
        year ? parseInt(year as string) : undefined
      );
      
      res.json(result);
    } catch (error) {
      console.error('AI monthly stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to get monthly stats' });
    }
  });

  app.get('/api/ai/spending-trends', authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "User not authenticated" });

      const { days } = req.query;
      const { AIQueryEngine } = await import('./ai-queries');
      const queryEngine = new AIQueryEngine(user.familyId);
      const result = await queryEngine.getSpendingTrends(
        days ? parseInt(days as string) : 30
      );
      
      res.json(result);
    } catch (error) {
      console.error('AI spending trends error:', error);
      res.status(500).json({ success: false, message: 'Failed to get spending trends' });
    }
  });

  // Error handling - note: notFound and errorHandler will be added after serveStatic in index.ts
  // app.use(notFound);
  // app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
