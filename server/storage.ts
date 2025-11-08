import { 
  users, 
  expenses, 
  chatMessages,
  chatSessions,
  savingsGoals,
  type User, 
  type InsertUser,
  type Expense,
  type InsertExpense,
  type ChatMessage,
  type InsertChatMessage,
  type ChatSession,
  type InsertChatSession,
  type SavingsGoal,
  type InsertSavingsGoal
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getFamilyMembers(familyId: string): Promise<User[]>;
  linkUserToFamily(userId: string, familyId: string): Promise<User>;
  
  // Expense operations
  createExpense(expense: InsertExpense & { userId: string; familyId?: string; aiConfidence?: number }): Promise<Expense>;
  getExpenses(familyId: string, limit?: number): Promise<Expense[]>;
  getExpensesByCategory(familyId: string, category: string): Promise<Expense[]>;
  getExpenseStats(familyId: string): Promise<{
    totalAmount: number;
    categoryStats: { category: string; amount: number; count: number }[];
    monthlyStats: { month: string; amount: number }[];
  }>;
  
  // Chat operations
  createChatSession(session: InsertChatSession & { userId: string; familyId?: string }): Promise<ChatSession>;
  getChatSessions(userId: string): Promise<ChatSession[]>;
  deleteChatSession(sessionId: string, userId: string): Promise<void>;
  createChatMessage(message: InsertChatMessage & { userId: string; familyId?: string; messageType: string; response?: string; sessionId: string }): Promise<ChatMessage>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  getChatHistory(familyId: string, limit?: number): Promise<ChatMessage[]>;
  
  // Savings Goals operations
  createSavingsGoal(goal: InsertSavingsGoal & { userId: string; familyId: string }): Promise<SavingsGoal>;
  getSavingsGoals(familyId: string): Promise<SavingsGoal[]>;
  getSavingsGoalById(id: string): Promise<SavingsGoal | undefined>;
  updateSavingsGoal(id: string, data: Partial<InsertSavingsGoal & { currentAmount?: number; status?: string }>): Promise<SavingsGoal>;
  deleteSavingsGoal(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Generate family ID for first family member, or use existing
    const familyId = `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        familyId,
      })
      .returning();
    return user;
  }

  async getFamilyMembers(familyId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.familyId, familyId));
  }

  async linkUserToFamily(userId: string, familyId: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ familyId })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Expense operations
  async createExpense(expense: InsertExpense & { userId: string; familyId?: string; aiConfidence?: number }): Promise<Expense> {
    const expenseData = {
      ...expense,
      amount: expense.amount.toString(), // Convert number to string for decimal field
      userId: expense.userId,
      familyId: expense.familyId,
      aiConfidence: expense.aiConfidence?.toString(),
    };
    
    const [newExpense] = await db
      .insert(expenses)
      .values(expenseData)
      .returning();
    return newExpense;
  }

  async getExpenses(familyId: string, limit: number = 50): Promise<any[]> {
    // Get all expenses with both creator and child user info
    const results = await db
      .select({
        id: expenses.id,
        userId: expenses.userId,
        childId: expenses.childId,
        description: expenses.description,
        amount: expenses.amount,
        category: expenses.category,
        aiConfidence: expenses.aiConfidence,
        isManualCategory: expenses.isManualCategory,
        familyId: expenses.familyId,
        createdAt: expenses.createdAt,
        creatorName: users.fullName, // Creator name
        creatorRole: users.role, // Creator role
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.userId, users.id))
      .where(eq(expenses.familyId, familyId))
      .orderBy(desc(expenses.createdAt))
      .limit(limit);
    
    // Get all family members for child lookup
    const allFamilyMembers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.familyId, familyId));
    
    const memberMap = new Map(allFamilyMembers.map(m => [m.id, m]));
    
    // Enrich expenses with correct userName (child if childId exists, otherwise creator)
    return results.map(exp => {
      let userName = exp.creatorName || 'Unknown';
      let userRole = exp.creatorRole || 'unknown';
      
      // If expense has childId, the expense belongs to the child
      if (exp.childId) {
        const childMember = memberMap.get(exp.childId);
        if (childMember) {
          userName = childMember.fullName;
          userRole = childMember.role;
        }
      }
      
      return {
        id: exp.id,
        userId: exp.userId,
        childId: exp.childId,
        description: exp.description,
        amount: exp.amount,
        category: exp.category,
        aiConfidence: exp.aiConfidence,
        isManualCategory: exp.isManualCategory,
        familyId: exp.familyId,
        createdAt: exp.createdAt,
        userName, // Correct userName (child or creator)
        userRole, // Correct userRole
      };
    });
  }

  async getExpensesByCategory(familyId: string, category: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(and(
        eq(expenses.familyId, familyId),
        eq(expenses.category, category)
      ))
      .orderBy(desc(expenses.createdAt));
  }

  async getExpenseStats(familyId: string): Promise<{
    totalAmount: number;
    categoryStats: { category: string; amount: number; count: number }[];
    monthlyStats: { month: string; amount: number }[];
  }> {
    // This is a simplified version - in production you'd use more complex SQL aggregations
    const allExpenses = await this.getExpenses(familyId, 1000);
    
    const totalAmount = allExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    const categoryMap = new Map<string, { amount: number; count: number }>();
    const monthlyMap = new Map<string, number>();
    
    allExpenses.forEach(expense => {
      const category = expense.category || 'Khác';
      const amount = parseFloat(expense.amount);
      const month = expense.createdAt?.toISOString().slice(0, 7) || '';
      
      // Category stats
      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)!;
        categoryMap.set(category, {
          amount: existing.amount + amount,
          count: existing.count + 1
        });
      } else {
        categoryMap.set(category, { amount, count: 1 });
      }
      
      // Monthly stats
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + amount);
    });
    
    const categoryStats = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count
    }));
    
    const monthlyStats = Array.from(monthlyMap.entries()).map(([month, amount]) => ({
      month,
      amount
    }));
    
    return { totalAmount, categoryStats, monthlyStats };
  }

  // Chat operations
  async createChatMessage(message: InsertChatMessage & { userId: string; familyId?: string; messageType: string; response?: string }): Promise<ChatMessage> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();

    // Optional Mongo logging of raw chat events
    try {
      const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
      if (mongoUri) {
        const { MongoClient } = await import("mongodb");
        const client = new MongoClient(mongoUri);
        await client.connect();
        const db = client.db("financeflow");
        await db.collection("chat_logs").createIndex({ familyId: 1, createdAt: -1 });
        await db.collection("chat_logs").insertOne({
          createdAt: new Date(),
          ...message,
          id: newMessage.id,
        });
        await client.close();
      }
    } catch (_err) {
      // non-blocking: ignore logging errors
    }

    return newMessage;
  }

  async getChatHistory(familyId: string, limit: number = 50): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.familyId, familyId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  // Chat Session operations
  async createChatSession(session: InsertChatSession & { userId: string; familyId?: string }): Promise<ChatSession> {
    const [newSession] = await db
      .insert(chatSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getChatSessions(userId: string): Promise<ChatSession[]> {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt));
  }

  async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    // Delete all messages in the session first
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    
    // Delete the session
    await db
      .delete(chatSessions)
      .where(and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, userId)
      ));
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  }

  // User management operations
  async getUserById(id: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user || null;
  }

  async updateUser(id: string, data: { email?: string; fullName?: string; role?: string; monthlyBudget?: number }): Promise<User> {
    const updateData: any = { ...data };
    if (data.monthlyBudget !== undefined) {
      updateData.monthlyBudget = data.monthlyBudget.toString();
    }
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    // Delete user's expenses first
    await db.delete(expenses).where(eq(expenses.userId, id));
    
    // Delete user's chat messages
    await db.delete(chatMessages).where(eq(chatMessages.userId, id));
    
    // Delete user's chat sessions
    await db.delete(chatSessions).where(eq(chatSessions.userId, id));
    
    // Delete user's savings goals
    await db.delete(savingsGoals).where(eq(savingsGoals.userId, id));
    
    // Delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  // Savings Goals operations
  async createSavingsGoal(goal: InsertSavingsGoal & { userId: string; familyId: string }): Promise<SavingsGoal> {
    const goalData: any = {
      ...goal,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: '0',
    };
    
    // Convert targetDate from string to Date if needed
    if (goal.targetDate) {
      goalData.targetDate = typeof goal.targetDate === 'string' ? new Date(goal.targetDate) : goal.targetDate;
    }
    
    const [newGoal] = await db
      .insert(savingsGoals)
      .values(goalData)
      .returning();
    return newGoal;
  }

  async getSavingsGoals(familyId: string): Promise<SavingsGoal[]> {
    return await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.familyId, familyId))
      .orderBy(desc(savingsGoals.createdAt));
  }

  async getSavingsGoalById(id: string): Promise<SavingsGoal | undefined> {
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, id))
      .limit(1);
    return goal || undefined;
  }

  async updateSavingsGoal(id: string, data: Partial<InsertSavingsGoal & { currentAmount?: number; status?: string }>): Promise<SavingsGoal> {
    const updateData: any = { ...data };
    if (data.targetAmount !== undefined) {
      updateData.targetAmount = data.targetAmount.toString();
    }
    if (data.currentAmount !== undefined) {
      updateData.currentAmount = data.currentAmount.toString();
    }
    // Convert targetDate from string to Date if needed
    if (data.targetDate !== undefined && data.targetDate !== null) {
      updateData.targetDate = typeof data.targetDate === 'string' ? new Date(data.targetDate) : data.targetDate;
    }
    updateData.updatedAt = new Date();
    
    const [updated] = await db
      .update(savingsGoals)
      .set(updateData)
      .where(eq(savingsGoals.id, id))
      .returning();
    return updated;
  }

  async deleteSavingsGoal(id: string): Promise<void> {
    await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
  }

}

export const storage = new DatabaseStorage();
